import { Link } from 'react-router-dom';
import {
  Search, ClipboardList, FileText,
  Truck, ShieldCheck, MessageSquare, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEP_COLORS = [
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-purple-50 border-purple-200 text-purple-700',
  'bg-orange-50 border-orange-200 text-orange-700',
  'bg-stone-50 border-stone-200 text-stone-700',
];

const STEP_DOTS = [
  'bg-amber-500', 'bg-emerald-500',
  'bg-purple-500', 'bg-orange-500', 'bg-stone-500',
];

const STEP_ICONS = [Search, ClipboardList, FileText, Truck, ShieldCheck];
const STEP_NUMS = ['01', '02', '03', '04', '05'];

export default function HowItWorks() {
  const { t } = useTranslation();

  const STEPS = STEP_NUMS.map((num, i) => ({
    num,
    icon: STEP_ICONS[i],
    title: t(`howItWorks.step${i + 1}title`),
    desc: t(`howItWorks.step${i + 1}desc`),
    color: STEP_COLORS[i],
    dot: STEP_DOTS[i],
  }));

  const FAQS = [1, 2, 3].map(n => ({
    q: t(`howItWorks.faq${n}q`),
    a: t(`howItWorks.faq${n}a`),
  }));

  const STATS = [
    { val: t('howItWorks.stat1val'), label: t('howItWorks.stat1label') },
    { val: t('howItWorks.stat2val'), label: t('howItWorks.stat2label') },
    { val: t('howItWorks.stat3val'), label: t('howItWorks.stat3label') },
    { val: t('howItWorks.stat4val'), label: t('howItWorks.stat4label') },
  ];

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-ma-gold text-xs font-semibold uppercase tracking-widest mb-3">{t('howItWorks.processLabel')}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('howItWorks.title')}</h1>
          <p className="text-stone-400 text-sm max-w-xl mx-auto">
            {t('howItWorks.sub')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-14 space-y-14">

        {/* Steps */}
        <div>
          <h2 className="text-xl font-bold text-stone-800 mb-8 text-center">{t('howItWorks.stepsTitle')}</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className={`flex items-start gap-5 border rounded-2xl p-5 ${step.color}`}>
                  <div className={`${step.dot} text-white rounded-xl w-12 h-12 flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[11px] font-black opacity-50 tracking-widest">{step.num}</span>
                      <h3 className="text-base font-bold">{step.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed opacity-80">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why us */}
        <div className="bg-ma-navy rounded-3xl p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">{t('howItWorks.whyTitle')}</h2>
          <p className="text-stone-400 text-sm mb-6 max-w-xl mx-auto">
            {t('howItWorks.whySub')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {STATS.map(stat => (
              <div key={stat.label} className="bg-white/10 rounded-2xl p-4">
                <p className="text-2xl font-black text-ma-gold">{stat.val}</p>
                <p className="text-xs text-stone-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-stone-800 mb-6 text-center">{t('howItWorks.faqTitle')}</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-stone-100 rounded-2xl p-5">
                <p className="font-semibold text-stone-800 text-sm mb-2">{faq.q}</p>
                <p className="text-stone-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/catalog"
            className="flex items-center justify-between bg-white border border-stone-200 hover:border-ma-red rounded-2xl p-5 group transition-all">
            <div>
              <p className="font-bold text-stone-800 mb-0.5">{t('howItWorks.browseCta')}</p>
              <p className="text-sm text-stone-500">{t('howItWorks.browseSub')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-ma-red group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/quote"
            className="flex items-center justify-between bg-ma-red hover:bg-[#9B1E24] rounded-2xl p-5 group transition-all text-white">
            <div>
              <p className="font-bold mb-0.5 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t('howItWorks.quoteCta')}</p>
              <p className="text-sm text-red-200">{t('howItWorks.quoteSub')}</p>
            </div>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
