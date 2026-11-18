import React from 'react';
import { motion } from 'motion/react';
import {
  BookHeart,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Film,
  Heart,
  Home,
  LayoutGrid,
  ScrollText,
  Search,
  Shield,
  Trophy,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { AppSection } from '../types/quran';

interface BottomNavBarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  user?: User | null;
}

const DOCK_ITEMS: {
  id: AppSection;
  labelKey: TranslationKey;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', labelKey: 'navHome', Icon: Home },
  { id: 'mushaf', labelKey: 'navMushaf', Icon: BookOpen },
  { id: 'index', labelKey: 'navIndex', Icon: LayoutGrid },
  { id: 'prayers', labelKey: 'navPrayers', Icon: Clock },
  { id: 'khatmah', labelKey: 'navKhatmah', Icon: CheckCircle2 },
  { id: 'qibla', labelKey: 'navQibla', Icon: Compass },
  { id: 'azkar', labelKey: 'navAzkar', Icon: Heart },
  { id: 'hisn', labelKey: 'navHisnShort', Icon: Shield },
  { id: 'duas', labelKey: 'navDuas', Icon: BookHeart },
  { id: 'prophets', labelKey: 'navProphetsShort', Icon: ScrollText },
  { id: 'competitions', labelKey: 'navCompetitions', Icon: Trophy },
  { id: 'promo_video', labelKey: 'navPromoVideoShort', Icon: Film },
  { id: 'search', labelKey: 'navSearch', Icon: Search },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeSection,
  onNavigate,
  user,
}) => {
  const { t } = useLanguage();
  const visibleItems = isAdminUser(user)
    ? DOCK_ITEMS
    : DOCK_ITEMS.filter((item) => item.id !== 'promo_video');

  return (
    <nav
      aria-label={t('navDockAria')}
      className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 sm:w-auto"
    >
      <div className="ios-glass-dock rounded-[22px] p-1.5 flex items-center justify-start sm:justify-center gap-0.5 sm:gap-1 overflow-x-auto">
        {visibleItems.map(({ id, labelKey, Icon }) => {
          const isActive = activeSection === id;
          return (
            <motion.button
              key={id}
              type="button"
              whileTap={{ scale: 0.91 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center min-w-[46px] sm:min-w-[60px] py-1.5 px-1.5 sm:px-2 rounded-2xl transition-colors duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                isActive
                  ? 'text-[#14532D] dark:text-emerald-300 font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="ios-dock-active-pill"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 32,
                    mass: 0.8,
                  }}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 border border-[#14532D]/15 dark:border-emerald-400/25 shadow-xs"
                />
              )}
              <Icon className="relative z-10 w-[18px] h-[18px] mb-0.5" />
              <span className="relative z-10 text-[11px] leading-tight">
                {t(labelKey)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
