import React, { useEffect, useId, useState } from 'react';
import { Expand, Loader2 } from 'lucide-react';
import { ProphetEra, ProphetStory } from '../types/quran';
import heroScrollImg from '../assets/images/prophets_hero_scroll_1794822418093.jpg';
import eraEarlyImg from '../assets/images/prophets_era_early_1794822418722.jpg';
import eraArabiaImg from '../assets/images/prophets_era_arabia_1794822418754.jpg';
import eraIsrailImg from '../assets/images/prophets_era_israil_1794822419506.jpg';
import eraSealImg from '../assets/images/prophets_era_seal_1794822419667.jpg';

export const PROPHETS_HERO_IMAGE = heroScrollImg;

const ERA_BACKDROP: Record<ProphetEra, string> = {
  early: eraEarlyImg,
  arab_nations: eraArabiaImg,
  bani_israil: eraIsrailImg,
  final_seal: eraSealImg,
};

export interface ProphetArtMeta {
  caption: string;
  paletteFrom: string;
  paletteTo: string;
  accentGold: string;
}

export const PROPHET_ART_META: Record<string, ProphetArtMeta> = {
  adam: {
    caption: 'لوحة تعبيرية: بساتين الجنة وغصن الزيتون ومطلع النور الأول على الأرض',
    paletteFrom: '#0F3D2E',
    paletteTo: '#244A39',
    accentGold: '#EAB308',
  },
  idris: {
    caption: 'لوحة تعبيرية: صحف الحكمة والقلم والأسطرلاب ومنازل النجوم في العلياء',
    paletteFrom: '#162447',
    paletteTo: '#1F4068',
    accentGold: '#F5C451',
  },
  nuh: {
    caption: 'لوحة تعبيرية: فُلك نوح تشق موجاً كالجبال في طمأنينة حتى استوت على الجودي',
    paletteFrom: '#102A43',
    paletteTo: '#1E4E68',
    accentGold: '#F3C677',
  },
  hud: {
    caption: 'لوحة تعبيرية: أعمدة إرم الشاهقة في الأحقاف وريح السحاب ونور النجاة',
    paletteFrom: '#5C3A21',
    paletteTo: '#8C5A2B',
    accentGold: '#FDE68A',
  },
  salih: {
    caption: 'لوحة تعبيرية: بيوت الحِجر المنحوتة في الجبال وعين الماء العذب في الوادي',
    paletteFrom: '#6D3B24',
    paletteTo: '#9A5B36',
    accentGold: '#FCD34D',
  },
  ibrahim: {
    caption: 'لوحة تعبيرية: النار وقد تحوّلت برداً وسلاماً وبستاناً وبناء البيت العتيق',
    paletteFrom: '#14452F',
    paletteTo: '#6B2D1B',
    accentGold: '#FBBF24',
  },
  lut: {
    caption: 'لوحة تعبيرية: شق الفجر الصادق على الآفاق الهادئة ومسير أهل النجاة بليل',
    paletteFrom: '#1E293B',
    paletteTo: '#3B2F4A',
    accentGold: '#FCD34D',
  },
  ismail: {
    caption: 'لوحة تعبيرية: تفجّر بئر زمزم المباركة بين الصفا والمروة ورفع قواعد الكعبة',
    paletteFrom: '#1F3A3D',
    paletteTo: '#7C5A33',
    accentGold: '#F59E0B',
  },
  ishaq: {
    caption: 'لوحة تعبيرية: ظلال أشجار الزيتون المباركة في الشام وبشارة النبوة والعهد',
    paletteFrom: '#234232',
    paletteTo: '#4B5D44',
    accentGold: '#EAB308',
  },
  yaqub: {
    caption: 'لوحة تعبيرية: خيمة الصبر الجميل وتطلّع الأمل الساهر تحت اثني عشر كوكباً',
    paletteFrom: '#172554',
    paletteTo: '#2A3F6E',
    accentGold: '#FDE047',
  },
  yusuf: {
    caption: 'لوحة تعبيرية: الشمس والقمر والأحد عشر كوكباً وسنابل مصر الذهبية',
    paletteFrom: '#1E3A5F',
    paletteTo: '#784E24',
    accentGold: '#FACC15',
  },
  ayyub: {
    caption: 'لوحة تعبيرية: مغتسل بارد وشراب يتدفق من صخرة الرحمة والشفاء بعد الصبر',
    paletteFrom: '#134E4A',
    paletteTo: '#29635E',
    accentGold: '#A7F3D0',
  },
  shuayb: {
    caption: 'لوحة تعبيرية: ميزان القسط والعدل بين وديان مدين الخضراء وأشجار الأيكة',
    paletteFrom: '#3B4D2B',
    paletteTo: '#6A5B32',
    accentGold: '#FCD34D',
  },
  musa: {
    caption: 'لوحة تعبيرية: نور الوادي المقدس عند جبل الطور وانفلاق البحر كالطود العظيم',
    paletteFrom: '#0C4A6E',
    paletteTo: '#164E63',
    accentGold: '#FDE047',
  },
  harun: {
    caption: 'لوحة تعبيرية: سرج المحراب المضيء وعمود الفصاحة في بيت العبادة والطمأنينة',
    paletteFrom: '#2D3A4B',
    paletteTo: '#4F5D73',
    accentGold: '#FBBF24',
  },
  dhulkifl: {
    caption: 'لوحة تعبيرية: محراب الوفاء بالعهد ومصباح الحِلم والصبر في جوف الليل',
    paletteFrom: '#243B3A',
    paletteTo: '#3D5A58',
    accentGold: '#F3C677',
  },
  dawud: {
    caption: 'لوحة تعبيرية: الجبال الأوّابة مع تسبيح الزبور وترانيم المزامير في الفجر',
    paletteFrom: '#1F2A44',
    paletteTo: '#3E4C6E',
    accentGold: '#F59E0B',
  },
  sulayman: {
    caption: 'لوحة تعبيرية: قصر الصرح الممرّد من قوارير وتاج الهدهد ونجمة الحكمة',
    paletteFrom: '#164E54',
    paletteTo: '#336B70',
    accentGold: '#FCD34D',
  },
  ilyas: {
    caption: 'لوحة تعبيرية: الغيث المنهمر على روابي الجبال الجرداء وعودة الخضرة بالإيمان',
    paletteFrom: '#1E3A4C',
    paletteTo: '#3B5E6F',
    accentGold: '#E0F2FE',
  },
  alyasa: {
    caption: 'لوحة تعبيرية: نهر الهدى الجاري بين أشجار السرو الهادئة في ضوء الصباح',
    paletteFrom: '#1B4332',
    paletteTo: '#2D6A4F',
    accentGold: '#D8F3DC',
  },
  yunus: {
    caption: 'لوحة تعبيرية: ظلمات البحر العميق ونداء التسبيح في العتمة وشجرة اليقطين على الساحل',
    paletteFrom: '#0B2447',
    paletteTo: '#19376D',
    accentGold: '#93C5FD',
  },
  zakariya: {
    caption: 'لوحة تعبيرية: نور المحراب السماوي وأزهار اللوز المباركة ببشارة يحيى',
    paletteFrom: '#2E3A32',
    paletteTo: '#574C3A',
    accentGold: '#FDE68A',
  },
  yahya: {
    caption: 'لوحة تعبيرية: مجرى النهر الصافي ونجمة الفجر الطاهرة في براري السلام',
    paletteFrom: '#164E63',
    paletteTo: '#285E6B',
    accentGold: '#BAE6FD',
  },
  isa: {
    caption: 'لوحة تعبيرية: جبل الزيتون ونور الهداية وحمامة السلام والمائدة المباركة',
    paletteFrom: '#1D4044',
    paletteTo: '#385C5E',
    accentGold: '#FEF08A',
  },
  muhammad: {
    caption: 'لوحة تعبيرية: جبل النور وغار حراء وقبة المسجد النبوي الشريف تحت هلال الرحمة للعالمين',
    paletteFrom: '#0E3B2C',
    paletteTo: '#14532D',
    accentGold: '#FACC15',
  },
};

function ProphetSymbolicScene({
  prophetId,
  accent,
}: {
  prophetId: string;
  accent: string;
}) {
  switch (prophetId) {
    case 'adam':
      return (
        <g>
          {/* Paradise arched gate + sun dawn + olive branch */}
          <path
            d="M80 148 L80 92 Q120 38 160 92 L160 148"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            opacity="0.9"
          />
          <circle cx="120" cy="84" r="18" fill={accent} opacity="0.22" />
          <circle cx="120" cy="84" r="10" fill={accent} opacity="0.7" />
          {/* Two leaves/boughs of Eden */}
          <path
            d="M120 146 L120 105 M120 128 Q100 120 96 108 M120 122 Q140 114 144 102"
            fill="none"
            stroke="#A7F3D0"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <ellipse cx="95" cy="107" rx="7" ry="4" transform="rotate(-25 95 107)" fill="#6EE7B7" opacity="0.85" />
          <ellipse cx="145" cy="101" rx="7" ry="4" transform="rotate(25 145 101)" fill="#6EE7B7" opacity="0.85" />
          <path d="M54 148 H186" stroke={accent} strokeWidth="1.5" opacity="0.45" />
        </g>
      );

    case 'idris':
      return (
        <g>
          {/* Astrolabe rings & celestial constellation & scroll */}
          <circle cx="120" cy="78" r="34" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.85" />
          <circle cx="120" cy="78" r="24" fill="none" stroke={accent} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
          <circle cx="120" cy="78" r="6" fill={accent} opacity="0.9" />
          <line x1="120" y1="36" x2="120" y2="120" stroke={accent} strokeWidth="1.2" opacity="0.55" />
          <line x1="78" y1="78" x2="162" y2="78" stroke={accent} strokeWidth="1.2" opacity="0.55" />
          {/* Scroll base */}
          <rect x="78" y="122" width="84" height="18" rx="6" fill="rgba(255,255,255,0.14)" stroke={accent} strokeWidth="1.5" />
          <circle cx="62" cy="52" r="2.2" fill="#FEF08A" />
          <circle cx="178" cy="48" r="2.5" fill="#FEF08A" />
          <circle cx="168" cy="110" r="1.8" fill="#FEF08A" />
        </g>
      );

    case 'nuh':
      return (
        <g>
          {/* Mount Judi silhouette behind Ark */}
          <path d="M40 132 L85 88 L120 112 L155 82 L200 132" fill="rgba(255,255,255,0.08)" />
          {/* Ark hull */}
          <path
            d="M58 106 L182 106 L166 130 Q120 136 74 130 Z"
            fill="rgba(243,198,119,0.22)"
            stroke={accent}
            strokeWidth="2.4"
          />
          <rect x="86" y="88" width="68" height="18" rx="3" fill="rgba(255,255,255,0.12)" stroke={accent} strokeWidth="1.8" />
          {/* Sail mast */}
          <line x1="120" y1="54" x2="120" y2="88" stroke={accent} strokeWidth="2" />
          <path d="M120 56 Q146 66 120 82 Z" fill={accent} opacity="0.7" />
          {/* Ocean waves */}
          <path
            d="M36 136 Q56 128 76 136 T116 136 T156 136 T196 136"
            fill="none"
            stroke="#BAE6FD"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M44 146 Q64 138 84 146 T124 146 T164 146 T204 146"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.8"
            opacity="0.7"
            strokeLinecap="round"
          />
        </g>
      );

    case 'hud':
      return (
        <g>
          {/* Lofty colonnaded pillars of Iram */}
          {[74, 102, 138, 166].map((x) => (
            <g key={x}>
              <rect x={x - 5} y="66" width="10" height="72" rx="2" fill="rgba(255,255,255,0.14)" stroke={accent} strokeWidth="1.6" />
              <rect x={x - 8} y="62" width="16" height="5" rx="1.5" fill={accent} opacity="0.8" />
            </g>
          ))}
          {/* Swirl of desert wind */}
          <path d="M46 92 Q90 80 132 94 T202 88" fill="none" stroke="#FDE68A" strokeWidth="1.8" opacity="0.7" strokeDasharray="6 4" />
          <path d="M38 112 Q84 102 128 114 T196 108" fill="none" stroke="#FED7AA" strokeWidth="1.5" opacity="0.6" strokeDasharray="5 4" />
          <path d="M48 142 Q120 134 192 142" fill="none" stroke={accent} strokeWidth="1.8" />
        </g>
      );

    case 'salih':
      return (
        <g>
          {/* Carved mountain stone facade of Al-Hijr */}
          <path d="M52 140 L74 58 L120 44 L166 58 L188 140 Z" fill="rgba(255,255,255,0.09)" stroke={accent} strokeWidth="1.8" />
          <path d="M96 140 L96 92 L144 92 L144 140" fill="rgba(0,0,0,0.28)" stroke={accent} strokeWidth="1.8" />
          <path d="M88 86 L152 86 M92 78 L148 78" stroke={accent} strokeWidth="2" opacity="0.85" />
          {/* Oasis spring */}
          <ellipse cx="120" cy="146" rx="46" ry="7" fill="#38BDF8" opacity="0.45" />
        </g>
      );

    case 'ibrahim':
      return (
        <g>
          {/* Kaaba sanctuary cube silhouette + flames turning into emerald leaves */}
          <rect x="94" y="64" width="52" height="48" rx="4" fill="#1C1917" stroke={accent} strokeWidth="2.2" />
          <line x1="94" y1="78" x2="146" y2="78" stroke={accent} strokeWidth="3" />
          {/* Cool peaceful lotus/flames blooming into leaves below */}
          <path d="M68 136 Q84 110 92 136 Q108 116 120 138 Q132 116 148 136 Q156 110 172 136" fill="none" stroke="#6EE7B7" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="120" cy="46" r="6" fill={accent} opacity="0.85" />
        </g>
      );

    case 'lut':
      return (
        <g>
          {/* Morning dawn rays rising cleanly behind distant hills */}
          <circle cx="120" cy="112" r="22" fill={accent} opacity="0.25" />
          <circle cx="120" cy="112" r="12" fill={accent} opacity="0.85" />
          <line x1="120" y1="44" x2="120" y2="82" stroke={accent} strokeWidth="1.8" opacity="0.7" />
          <line x1="78" y1="68" x2="100" y2="92" stroke={accent} strokeWidth="1.6" opacity="0.6" />
          <line x1="162" y1="68" x2="140" y2="92" stroke={accent} strokeWidth="1.6" opacity="0.6" />
          <path d="M36 142 Q82 114 126 128 T204 134 L204 152 L36 152 Z" fill="rgba(255,255,255,0.12)" stroke={accent} strokeWidth="1.5" />
        </g>
      );

    case 'ismail':
      return (
        <g>
          {/* Zamzam spring arches & sparkling ripples */}
          <path d="M62 126 Q90 92 112 126" fill="rgba(255,255,255,0.1)" stroke={accent} strokeWidth="1.8" />
          <path d="M128 126 Q152 96 178 126" fill="rgba(255,255,255,0.1)" stroke={accent} strokeWidth="1.8" />
          {/* Gushing spring */}
          <path d="M120 130 Q106 106 94 114" fill="none" stroke="#7DD3FC" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M120 130 Q134 106 146 114" fill="none" stroke="#7DD3FC" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="120" cy="136" rx="44" ry="9" fill="#38BDF8" opacity="0.32" stroke="#BAE6FD" strokeWidth="1.5" />
          <rect x="108" y="64" width="24" height="22" rx="2" fill="#1C1917" stroke={accent} strokeWidth="1.8" />
        </g>
      );

    case 'ishaq':
      return (
        <g>
          {/* Olive tree sanctuary + covenant crescent arch */}
          <path d="M72 142 Q120 40 168 142" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.6" />
          <line x1="120" y1="142" x2="120" y2="86" stroke="#D6D3D1" strokeWidth="4" strokeLinecap="round" />
          <circle cx="120" cy="76" r="24" fill="#6EE7B7" opacity="0.22" stroke="#A7F3D0" strokeWidth="1.8" />
          <circle cx="102" cy="84" r="14" fill="#6EE7B7" opacity="0.2" />
          <circle cx="138" cy="84" r="14" fill="#6EE7B7" opacity="0.2" />
          <path d="M114 42 A10 10 0 1 0 130 52 A8 8 0 1 1 114 42" fill={accent} />
        </g>
      );

    case 'yaqub':
      return (
        <g>
          {/* Night canopy / tent with twelve luminous stars */}
          <path d="M64 142 L120 90 L176 142 Z" fill="rgba(255,255,255,0.12)" stroke={accent} strokeWidth="2" />
          <line x1="120" y1="90" x2="120" y2="142" stroke={accent} strokeWidth="1.5" opacity="0.6" />
          {/* 12 stars arc */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
            const angle = Math.PI + (i / 11) * Math.PI;
            const cx = 120 + Math.cos(angle) * 68;
            const cy = 96 + Math.sin(angle) * 48;
            return <circle key={i} cx={cx} cy={cy} r="2.6" fill={accent} />;
          })}
        </g>
      );

    case 'yusuf':
      return (
        <g>
          {/* Sun, crescent moon & 11 stars + golden wheat */}
          <circle cx="120" cy="66" r="13" fill={accent} opacity="0.88" />
          <path d="M156 54 A11 11 0 1 0 170 68 A9 9 0 1 1 156 54" fill="#FEF08A" />
          {[62, 74, 88, 102, 138, 152, 166, 178, 80, 120, 160].map((x, i) => (
            <circle key={i} cx={x} cy={i < 8 ? 44 : 88} r="2.2" fill="#FEF9C3" />
          ))}
          {/* 7 golden wheat ears */}
          {[-24, -16, -8, 0, 8, 16, 24].map((offset) => (
            <path
              key={offset}
              d={`M${120 + offset} 144 Q${120 + offset * 1.2} 122 ${120 + offset * 1.4} 108`}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>
      );

    case 'ayyub':
      return (
        <g>
          {/* Rock & healing water spring + green leaves */}
          <path d="M52 138 Q68 92 98 106 L108 138 Z" fill="rgba(255,255,255,0.14)" stroke={accent} strokeWidth="1.8" />
          <path d="M98 118 Q134 112 152 138" fill="none" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" />
          <path d="M104 128 Q136 122 162 142" fill="none" stroke="#A5F3FC" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="136" cy="144" rx="44" ry="7" fill="#22D3EE" opacity="0.35" />
          <circle cx="158" cy="68" r="14" fill="#6EE7B7" opacity="0.25" />
          <path d="M158 84 L158 56 M158 72 L168 64 M158 68 L148 60" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'shuayb':
      return (
        <g>
          {/* Golden scales of justice */}
          <line x1="120" y1="54" x2="120" y2="140" stroke={accent} strokeWidth="2.6" />
          <line x1="76" y1="68" x2="164" y2="68" stroke={accent} strokeWidth="2.4" />
          <line x1="76" y1="68" x2="64" y2="104" stroke={accent} strokeWidth="1.4" />
          <line x1="76" y1="68" x2="88" y2="104" stroke={accent} strokeWidth="1.4" />
          <path d="M60 104 Q76 116 92 104 Z" fill={accent} opacity="0.7" />
          <line x1="164" y1="68" x2="152" y2="104" stroke={accent} strokeWidth="1.4" />
          <line x1="164" y1="68" x2="176" y2="104" stroke={accent} strokeWidth="1.4" />
          <path d="M148 104 Q164 116 180 104 Z" fill={accent} opacity="0.7" />
          <path d="M96 140 H144" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </g>
      );

    case 'musa':
      return (
        <g>
          {/* Parted sea walls + glowing radiance at Tur */}
          <circle cx="120" cy="66" r="20" fill={accent} opacity="0.24" />
          <circle cx="120" cy="66" r="10" fill={accent} opacity="0.85" />
          {/* Left and right parted sea waves */}
          <path d="M36 96 Q74 96 88 140 L36 140 Z" fill="#38BDF8" opacity="0.4" stroke="#BAE6FD" strokeWidth="2" />
          <path d="M204 96 Q166 96 152 140 L204 140 Z" fill="#38BDF8" opacity="0.4" stroke="#BAE6FD" strokeWidth="2" />
          {/* Golden staff */}
          <line x1="120" y1="92" x2="120" y2="146" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M120 92 Q128 84 134 90" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );

    case 'harun':
      return (
        <g>
          {/* Sacred seven-branch sanctuary candelabrum */}
          <line x1="120" y1="56" x2="120" y2="140" stroke={accent} strokeWidth="2.8" />
          <path d="M84 80 Q84 112 120 112 Q156 112 156 80" fill="none" stroke={accent} strokeWidth="2.2" />
          <path d="M98 84 Q98 104 120 104 Q142 104 142 84" fill="none" stroke={accent} strokeWidth="1.8" />
          {[84, 98, 120, 142, 156].map((x, idx) => (
            <circle key={x} cx={x} cy={idx === 2 ? 52 : 76} r="3.5" fill="#FEF08A" />
          ))}
          <path d="M98 140 H142" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </g>
      );

    case 'dhulkifl':
      return (
        <g>
          {/* Illuminated prayer mihrab + hanging lantern */}
          <path d="M74 142 L74 84 Q120 38 166 84 L166 142" fill="rgba(255,255,255,0.09)" stroke={accent} strokeWidth="2.2" />
          <line x1="120" y1="54" x2="120" y2="82" stroke={accent} strokeWidth="1.6" />
          <path d="M108 82 L132 82 L126 104 L114 104 Z" fill={accent} opacity="0.8" />
          <circle cx="120" cy="94" r="18" fill={accent} opacity="0.2" />
          <rect x="94" y="124" width="52" height="10" rx="3" fill="rgba(255,255,255,0.18)" />
        </g>
      );

    case 'dawud':
      return (
        <g>
          {/* Echoing mountains + golden psaltery harp strings */}
          <path d="M40 140 L76 88 L108 118 L142 80 L198 140" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
          <path d="M96 132 Q92 78 120 64 Q148 78 144 132 Z" fill="rgba(245,158,11,0.16)" stroke={accent} strokeWidth="2.2" />
          {[108, 114, 120, 126, 132].map((x) => (
            <line key={x} x1={x} y1="74" x2={x} y2="132" stroke={accent} strokeWidth="1.2" opacity="0.85" />
          ))}
        </g>
      );

    case 'sulayman':
      return (
        <g>
          {/* Octagonal Star of Wisdom + crystal arched dome + hoopoe crest */}
          <polygon
            points="120,52 134,80 164,80 140,98 148,128 120,110 92,128 100,98 76,80 106,80"
            fill="rgba(252,211,77,0.16)"
            stroke={accent}
            strokeWidth="2"
          />
          <circle cx="120" cy="92" r="14" fill="none" stroke={accent} strokeWidth="1.6" />
          <path d="M52 142 H188" stroke="#67E8F9" strokeWidth="2" opacity="0.6" />
        </g>
      );

    case 'ilyas':
      return (
        <g>
          {/* Rain cloud blessing arid terraced hills */}
          <path d="M84 82 Q82 64 102 62 Q114 48 134 58 Q154 58 156 78 Q158 88 144 88 L94 88 Q84 88 84 82 Z" fill="rgba(255,255,255,0.2)" stroke="#E0F2FE" strokeWidth="1.8" />
          {[96, 112, 128, 144].map((x, idx) => (
            <line key={x} x1={x} y1="96" x2={x - 5} y2={idx % 2 === 0 ? 114 : 110} stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
          ))}
          <path d="M44 142 Q90 116 132 130 T200 132" fill="none" stroke="#6EE7B7" strokeWidth="2.4" />
        </g>
      );

    case 'alyasa':
      return (
        <g>
          {/* Calm river valley flanked by cypresses */}
          <path d="M116 86 Q102 112 132 144 M126 86 Q116 112 146 144" fill="none" stroke="#7DD3FC" strokeWidth="2.4" />
          {[76, 164].map((x) => (
            <path key={x} d={`M${x} 138 Q${x - 10} 98 ${x} 66 Q${x + 10} 98 ${x} 138 Z`} fill="#6EE7B7" opacity="0.35" stroke="#A7F3D0" strokeWidth="1.5" />
          ))}
          <circle cx="120" cy="64" r="11" fill={accent} opacity="0.7" />
        </g>
      );

    case 'yunus':
      return (
        <g>
          {/* Deep ocean layers + whale-tail crescent + gourd vine */}
          <path d="M36 108 Q64 98 92 108 T148 108 T204 108" fill="none" stroke="#93C5FD" strokeWidth="2.4" />
          <path d="M36 126 Q64 116 92 126 T148 126 T204 126" fill="none" stroke="#60A5FA" strokeWidth="2" opacity="0.8" />
          {/* Stylized whale tail */}
          <path d="M120 118 L120 96 Q106 84 94 90 Q106 98 118 98 Q130 98 146 90 Q134 84 120 96" fill="#93C5FD" opacity="0.85" />
          {/* Moonlight & Yaktin leaf */}
          <path d="M168 48 A10 10 0 1 0 180 62 A8 8 0 1 1 168 48" fill="#FEF08A" />
          <circle cx="72" cy="66" r="14" fill="#6EE7B7" opacity="0.22" stroke="#6EE7B7" strokeWidth="1.6" />
        </g>
      );

    case 'zakariya':
      return (
        <g>
          {/* Sanctuary archway with descending light beam & blossoms */}
          <path d="M78 142 L78 86 Q120 42 162 86 L162 142" fill="rgba(255,255,255,0.08)" stroke={accent} strokeWidth="2" />
          <polygon points="120,58 94,142 146,142" fill={accent} opacity="0.16" />
          <circle cx="104" cy="108" r="5" fill="#FDE68A" opacity="0.8" />
          <circle cx="134" cy="98" r="4" fill="#FDE68A" opacity="0.8" />
          <circle cx="120" cy="84" r="6" fill="#FEF08A" opacity="0.9" />
        </g>
      );

    case 'yahya':
      return (
        <g>
          {/* Pure stream & glowing morning star */}
          <path d="M84 144 Q110 120 124 98 T152 64" fill="none" stroke="#BAE6FD" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M70 144 Q98 122 114 98" fill="none" stroke="#7DD3FC" strokeWidth="1.8" opacity="0.7" />
          <polygon points="120,42 124,54 136,54 126,62 130,74 120,66 110,74 114,62 104,54 116,54" fill={accent} opacity="0.88" />
        </g>
      );

    case 'isa':
      return (
        <g>
          {/* Olive mount + dove silhouette + crescent lantern */}
          <path d="M44 140 Q94 112 128 126 T196 134" fill="none" stroke="#A7F3D0" strokeWidth="2.2" />
          {/* Rising peace dove geometric */}
          <path d="M98 84 Q112 68 126 78 Q138 66 150 74 Q134 88 122 92 Q110 92 98 84 Z" fill="rgba(255,255,255,0.85)" />
          <circle cx="120" cy="54" r="11" fill={accent} opacity="0.28" />
          <path d="M88 118 H152" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );

    case 'muhammad':
    default:
      return (
        <g>
          {/* Green Dome silhouette + minarets + radiant crescent */}
          <path d="M88 136 L88 108 Q120 68 152 108 L152 136 Z" fill="#10B981" opacity="0.45" stroke={accent} strokeWidth="2.2" />
          {/* Crescent finial */}
          <line x1="120" y1="68" x2="120" y2="82" stroke={accent} strokeWidth="2" />
          <path d="M116 58 A7 7 0 1 0 126 66 A5.5 5.5 0 1 1 116 58" fill={accent} />
          {/* Flanking minarets */}
          <rect x="64" y="84" width="10" height="52" rx="2" fill="rgba(255,255,255,0.16)" stroke={accent} strokeWidth="1.6" />
          <polygon points="69,70 63,84 75,84" fill={accent} opacity="0.85" />
          <rect x="166" y="84" width="10" height="52" rx="2" fill="rgba(255,255,255,0.16)" stroke={accent} strokeWidth="1.6" />
          <polygon points="171,70 165,84 177,84" fill={accent} opacity="0.85" />
          <path d="M52 138 H188" stroke={accent} strokeWidth="2" />
        </g>
      );
  }
}

interface ProphetIllustrationProps {
  prophet: ProphetStory;
  variant?: 'card' | 'hero' | 'lightbox';
  aiImageUrl?: string | null;
  isGeneratingArt?: boolean;
  onGenerateAiArt?: () => void;
  onOpenLightbox?: () => void;
}

export const ProphetIllustration: React.FC<ProphetIllustrationProps> = ({
  prophet,
  variant = 'card',
  aiImageUrl,
  isGeneratingArt = false,
  onGenerateAiArt,
  onOpenLightbox,
}) => {
  const [imgError, setImgError] = useState(false);
  const [aiImgError, setAiImgError] = useState(false);
  const patternId = useId();

  useEffect(() => {
    setImgError(false);
  }, [prophet.id]);

  useEffect(() => {
    setAiImgError(false);
  }, [aiImageUrl, prophet.id]);

  const meta = PROPHET_ART_META[prophet.id] ?? {
    caption: `لوحة تعبيرية مستوحاة من قصة ${prophet.name}`,
    paletteFrom: '#14532D',
    paletteTo: '#1E3A5F',
    accentGold: '#FACC15',
  };
  const backdropSrc = ERA_BACKDROP[prophet.era];
  const hasActiveAiImage = Boolean(aiImageUrl && !aiImgError);

  const aspectClass =
    variant === 'card'
      ? 'aspect-[16/9]'
      : variant === 'hero'
      ? 'aspect-[16/9] sm:aspect-[21/9]'
      : 'aspect-[16/9]';

  return (
    <figure className="w-full space-y-2">
      <div
        className={`relative w-full overflow-hidden ${
          variant === 'card'
            ? 'rounded-2xl'
            : 'rounded-2xl sm:rounded-3xl border border-stone-200/80 dark:border-white/10'
        } ${aspectClass} select-none`}
        style={{
          background: `linear-gradient(135deg, ${meta.paletteFrom} 0%, ${meta.paletteTo} 100%)`,
        }}
      >
        {hasActiveAiImage ? (
          <img
            src={aiImageUrl!}
            alt={`${meta.caption} — لوحة بالذكاء الاصطناعي`}
            referrerPolicy="no-referrer"
            onError={() => setAiImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {/* Painterly Era Artwork Backdrop */}
            {!imgError && (
              <img
                src={backdropSrc}
                alt={meta.caption}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="absolute inset-0 w-full h-full object-cover opacity-55 mix-blend-luminosity scale-[1.02]"
              />
            )}

            {/* Measured Contrast Scrim */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 45%, rgba(0,0,0,0.18) 0%, rgba(12,18,16,0.72) 100%)`,
              }}
            />

            {/* Islamic Geometric Lattice Border + Bespoke Symbolic Scene SVG */}
            <svg
              viewBox="0 0 240 165"
              className="relative z-10 w-full h-full"
              role="img"
              aria-label={meta.caption}
            >
              <defs>
                <pattern
                  id={patternId}
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M12 0 L24 12 L12 24 L0 12 Z"
                    fill="none"
                    stroke={meta.accentGold}
                    strokeWidth="0.4"
                    opacity="0.16"
                  />
                </pattern>
              </defs>

              <rect width="240" height="165" fill={`url(#${patternId})`} />

              {/* Arch Manuscript Frame */}
              <path
                d="M16 154 L16 56 Q120 6 224 56 L224 154 Z"
                fill="rgba(10,16,14,0.28)"
                stroke={meta.accentGold}
                strokeOpacity="0.48"
                strokeWidth="1.2"
              />

              <ProphetSymbolicScene
                prophetId={prophet.id}
                accent={meta.accentGold}
              />
            </svg>
          </>
        )}

        {isGeneratingArt && (
          <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-stone-100 p-4 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
            <span className="text-xs sm:text-sm font-medium">
              جاري توليد لوحة القصة بالذكاء الاصطناعي...
            </span>
          </div>
        )}

        {/* Bottom Caption Scrim & Action Controls on Hero */}
        {variant === 'hero' && (
          <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-wrap items-end justify-between gap-2.5">
            <p className="text-[11px] sm:text-xs text-stone-100/95 leading-snug">
              {hasActiveAiImage
                ? `لوحة مولّدة بالذكاء الاصطناعي · ${meta.caption}`
                : meta.caption}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {onGenerateAiArt && (
                <button
                  type="button"
                  disabled={isGeneratingArt}
                  onClick={onGenerateAiArt}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14532D]/85 hover:bg-[#14532D] disabled:opacity-65 text-stone-100 text-[11px] font-medium whitespace-nowrap shrink-0 backdrop-blur-md border border-white/20"
                >
                  <span>
                    {isGeneratingArt
                      ? 'جاري رسم اللوحة...'
                      : hasActiveAiImage
                      ? 'إعادة رسم بالذكاء الاصطناعي'
                      : 'رسم لوحة AI خاصة'}
                  </span>
                </button>
              )}
              {onOpenLightbox && (
                <button
                  type="button"
                  onClick={onOpenLightbox}
                  aria-label="عرض اللوحة بالحجم الكامل"
                  className="ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 hover:bg-black/75 text-stone-100 text-[11px] font-medium whitespace-nowrap shrink-0 backdrop-blur-md border border-white/15"
                >
                  <Expand className="w-3.5 h-3.5" />
                  <span>تكبير اللوحة</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {variant === 'lightbox' && (
        <figcaption className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 text-center pt-1">
          {hasActiveAiImage
            ? `لوحة مولّدة بالذكاء الاصطناعي · ${meta.caption}`
            : meta.caption}
        </figcaption>
      )}
    </figure>
  );
};
