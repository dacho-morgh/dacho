export type LogoAsset = {
  id: string
  name: string
  href?: string
  newTab?: boolean
  width: string
  src: string
}

export const defaultLogos: LogoAsset[] = [
  {
    id: 'faraboors',
    name: 'فرابورس ایران',
    href: 'https://www.ifb.ir/',
    width: 'w-[219px] sm:w-[292px]',
    src: '/icons/partners/faraboors.svg',
  },
  {
    id: 'noavari',
    name: 'صندوق نوآوری و شکوفایی',
    href: 'https://www.inif.ir/',
    width: 'w-[88px] sm:w-[118px]',
    src: '/icons/partners/noavari.svg',
  },
  {
    id: 'oloom',
    name: 'دانشگاه علوم پزشکی بوشهر',
    href: 'https://bpums.ac.ir/',
    width: 'w-[83px] sm:w-[110px]',
    src: '/icons/partners/oloom.svg',
  },
  {
    id: 'park',
    name: 'پارک علم و فناوری خلیج فارس',
    href: 'https://pgstp.ir/',
    width: 'w-[112px] sm:w-[149px]',
    src: '/icons/partners/park.svg',
  },
  {
    id: 'neybad',
    name: 'سکوی تامین مالی جمعی نی‌باد',
    href: 'https://neybadcrowd.ir/',
    width: 'w-[86px] sm:w-[115px]',
    src: '/icons/partners/neybad.svg',
  },
  {
    id: 'pgu',
    name: 'دانشگاه خلیج فارس',
    href: 'https://www.pgu.ac.ir',
    width: 'w-[61px] sm:w-[82px]',
    src: '/icons/partners/pgu.svg',
  },
  {
    id: 'riasat',
    name: 'معاونت علمی و فناوری ریاست جمهوری',
    href: 'https://isti.ir/',
    width: 'w-[73px] sm:w-[98px]',
    src: '/icons/partners/riasat.svg',
  },
  {
    id: 'sanaye',
    name: 'صندوق حمایت از صنایع پیشرفته',
    href: 'http://www.imf.ir/',
    width: 'w-[128px] sm:w-[171px]',
    src: '/icons/partners/sanaye.svg',
  },
]
