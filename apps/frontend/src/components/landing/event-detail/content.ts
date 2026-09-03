export const EVENT_DETAIL_IMAGES = {
  about: '/figma/event-detail/about.png',
  guests: [
    '/figma/event-detail/guest-1.jpeg',
    '/figma/event-detail/guest-2.jpeg',
    '/figma/event-detail/guest-1.jpeg',
    '/figma/event-detail/guest-2.jpeg',
  ],
  hero: '/figma/event-detail/hero.png',
  opportunities: '/figma/event-detail/opportunities.png',
  venueMap: '/figma/event-detail/venue-map.png',
} as const

export const ABOUT_PARAGRAPHS = [
  'این برنامه با هدف ایجاد ارتباط مؤثر و مستقیم میان شرکت‌های فناور، دانش‌بنیان و فعالان زیست‌بوم نوآوری با صنایع بزرگ نفت، گاز و پتروشیمی برگزار می‌شود. حضور کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر در مجاورت قطب انرژی کشور، این فرصت را فراهم می‌کند تا شرکت‌های فناور بدون واسطه با مدیران، تصمیم‌گیران و کارشناسان فنی صنایع و مجتمع‌های بزرگ انرژی ارتباط برقرار کرده و راهکارهای خود را متناسب با نیازهای واقعی صنعت معرفی کنند.',
  'تمرکز این برنامه صرفاً بر معرفی محصولات و دستاوردهای فناورانه نیست؛ بلکه تلاش می‌شود زمینه‌ای برای شناسایی چالش‌های واقعی صنعت، بررسی راهکارهای موجود و شکل‌گیری ارتباطات حرفه‌ای و همکاری‌های مشترک فراهم شود. شرکت‌های حاضر می‌توانند فرصت‌های تازه‌ای برای همکاری با صنایع، پیمانکاران و دیگر بازیگران زنجیره ارزش انرژی شناسایی کنند.',
] as const

type Opportunity = {
  description?: string
  title: string
}

export const OPPORTUNITIES: readonly Opportunity[] = [
  {
    description: 'امکان ارائه راهکار و مذاکره مستقیم با مدیران و کارشناسان صنایع مرتبط.',
    title: 'ارتباط مستقیم با صنعت',
  },
  { title: 'معرفی توانمندی‌ها' },
  { title: 'شناسایی فرصت‌های همکاری' },
  { title: 'توسعه بازار' },
] as const

export const AUDIENCES = [
  'شرکت‌های دانش‌بنیان',
  'شرکت‌های فناور',
  'استارتاپ‌ها',
  'تیم‌های نوآور',
] as const

export const REGISTRATION_STEPS = [
  {
    description: 'اطلاعات شرکت و نماینده خود را ثبت کنید.',
    title: 'ثبت نام',
  },
  {
    description: 'توانمندی‌ها، محصولات و سوابق مرتبط خود را معرفی کنید.',
    title: 'ارسال اطلاعات و رزومه',
  },
  {
    description: 'اطلاعات ارسالی توسط تیم برگزارکننده بررسی می‌شود.',
    title: 'بررسی و ارزیابی',
  },
  {
    description: 'نتیجه بررسی و نحوه حضور به شرکت اطلاع داده می‌شود.',
    title: 'اعلام نتایج',
  },
] as const

export type EventDetailKind = 'event' | 'exhibition'

export const COPY_BY_KIND = {
  event: {
    aboutTitle: 'درباره این رویداد',
    audienceDescription:
      'این رویداد برای شرکت‌های دانش‌بنیان، فناور و مجموعه‌هایی طراحی شده است که راهکار، محصول یا فناوری مرتبط با نیازهای صنعت انرژی ارائه می‌کنند.',
    audienceTitle: 'مخاطبان رویداد',
    ctaDescription:
      'در رویداد شرکت کنید و فرصت خود را برای ارتباط مستقیم با بازیگران صنعت انرژی ایجاد کنید.',
    ctaTitle: 'آماده‌اید راهکار خود را به صنعت معرفی کنید؟',
    guestTitle: 'مهمانان رویداد',
    opportunityTitle: 'این رویداد چه فرصتی برای شما ایجاد می‌کند؟',
    registrationLabel: 'ثبت نام در رویداد',
    stepsTitle: 'مراحل شرکت در رویداد',
    typeLabel: 'رویداد تخصصی',
  },
  exhibition: {
    aboutTitle: 'درباره این نمایشگاه',
    audienceDescription:
      'این نمایشگاه برای شرکت‌های دانش‌بنیان، فناور و مجموعه‌هایی طراحی شده است که راهکار، محصول یا فناوری مرتبط با نیازهای صنعت انرژی ارائه می‌کنند.',
    audienceTitle: 'مخاطبان نمایشگاه',
    ctaDescription:
      'در نمایشگاه شرکت کنید و فرصت خود را برای ارتباط مستقیم با بازیگران صنعت انرژی ایجاد کنید.',
    ctaTitle: 'آماده‌اید توانمندی خود را به صنعت معرفی کنید؟',
    guestTitle: 'مهمانان نمایشگاه',
    opportunityTitle: 'این نمایشگاه چه فرصتی برای شما ایجاد می‌کند؟',
    registrationLabel: 'ثبت نام در نمایشگاه',
    stepsTitle: 'مراحل شرکت در نمایشگاه',
    typeLabel: 'نمایشگاه تخصصی',
  },
} as const

export const SECTION_DESCRIPTION =
  'ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.'
