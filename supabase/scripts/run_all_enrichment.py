#!/usr/bin/env python3
"""
Applique les fichiers update_by_name_*.sql sur Supabase via psycopg3.

Strategie robuste :
- Chaque fichier est execute EN UN SEUL batch (1 aller-retour reseau/fichier).
  -> ~232 allers-retours au lieu de ~116 000 : bien plus rapide et stable.
- Idempotent : la garde "AND source_site IS NULL" empeche tout ecrasement,
  donc relancer apres une coupure reprend sans doublon.
- Si un batch echoue (apostrophe non echappee -> rollback du fichier),
  on bascule ce fichier SEUL en mode ligne-par-ligne pour garder les lignes
  valides et logguer precisement la/les ligne(s) fautive(s).
- Keepalives TCP + reconnexion auto si la connexion tombe.
- Sortie en direct (flush) pour suivre la progression.

Usage :
    $env:DATABASE_URL = "postgresql://postgres.xxx:PWD@...:5432/postgres"
    python -u supabase/scripts/run_all_enrichment.py
"""
import os
import sys
import glob
import time
import psycopg

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    sys.exit("ERREUR: variable DATABASE_URL non definie.")

# Keepalives pour empecher le pooler de couper une connexion longue.
CONN_KW = dict(
    autocommit=True,
    keepalives=1,
    keepalives_idle=30,
    keepalives_interval=10,
    keepalives_count=5,
    connect_timeout=30,
)


def connect():
    return psycopg.connect(DB_URL, **CONN_KW)


def p(msg):
    print(msg, flush=True)


script_dir = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(script_dir, "update_by_name_*.sql")))
p(f"Fichiers a appliquer : {len(files)}")

total_lines_ok = 0
failures = []          # (fichier, num_ligne, message)
files_line_mode = []   # fichiers ayant du basculer en ligne-par-ligne

conn = connect()

for idx, path in enumerate(files, start=1):
    fname = os.path.basename(path)
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()
    stmt_lines = [l for l in content.splitlines()
                  if l.strip().upper().startswith("UPDATE")]
    n = len(stmt_lines)

    # --- Tentative 1 : batch complet ---
    batched = False
    for attempt in range(2):  # 1 retry en cas de coupure connexion
        try:
            with conn.cursor() as cur:
                cur.execute(content)
            total_lines_ok += n
            batched = True
            break
        except (psycopg.OperationalError, psycopg.InterfaceError) as e:
            # connexion tombee -> reconnecte et retente le batch
            p(f"   (reconnexion apres coupure: {str(e).splitlines()[0]})")
            try:
                conn.close()
            except Exception:
                pass
            time.sleep(2)
            conn = connect()
            continue
        except Exception:
            # erreur SQL (apostrophe...) -> rollback du batch, on passe en ligne-a-ligne
            break

    if batched:
        p(f"[{idx:3d}/{len(files)}] {fname:32s} {n:4d} ok (batch)")
        continue

    # --- Tentative 2 : ligne par ligne pour CE fichier ---
    files_line_mode.append(fname)
    line_ok = 0
    for lineno, stmt in enumerate(content.splitlines(), start=1):
        s = stmt.strip()
        if not s.upper().startswith("UPDATE"):
            continue
        for attempt in range(2):
            try:
                with conn.cursor() as cur:
                    cur.execute(s)
                line_ok += 1
                break
            except (psycopg.OperationalError, psycopg.InterfaceError):
                try:
                    conn.close()
                except Exception:
                    pass
                time.sleep(2)
                conn = connect()
                continue
            except Exception as e:  # erreur SQL sur cette ligne
                failures.append((fname, lineno, str(e).splitlines()[0]))
                break
    total_lines_ok += line_ok
    p(f"[{idx:3d}/{len(files)}] {fname:32s} {line_ok:4d} ok / {n} "
      f"({len(failures)} echec(s) cumules) [mode ligne]")

p("\n===== RESUME =====")
p(f"UPDATE reussis        : {total_lines_ok}")
p(f"Fichiers en mode ligne: {len(files_line_mode)}")
p(f"Lignes en echec       : {len(failures)}")

if failures:
    report = os.path.join(script_dir, "enrichment_failures.txt")
    with open(report, "w", encoding="utf-8") as rf:
        for fname, lineno, msg in failures:
            rf.write(f"{fname}:{lineno}\t{msg}\n")
    p(f"Detail des echecs -> {report}")
    for fname, lineno, msg in failures[:30]:
        p(f"  {fname}:{lineno}  {msg}")

with conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM products WHERE source_site IS NOT NULL;")
    enriched = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM products;")
    total = cur.fetchone()[0]
p(f"\nProduits enrichis : {enriched} / {total}")
conn.close()
