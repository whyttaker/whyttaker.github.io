export const site = {
  name: 'Whittaker Worland',
  first: 'Whittaker',
  last: 'Worland',
  monogram: 'WW',
  role: 'Software Development Engineer',
  company: 'Amazon',
  location: 'San Diego, CA',
  education: 'Computer Science — UC Irvine',
  school: 'Donald Bren School of Information & Computer Sciences',
  email: 'whyttaker@gmail.com',
  phone: '714-913-3626',
  resumePdf: '/resume/Whittaker-Worland-Resume.pdf',
  description:
    'Software Development Engineer at Amazon building scalable distributed systems and AI-powered tooling for financial infrastructure handling hundreds of millions of daily transactions.',
} as const;

export const links = [
  { label: 'GitHub', href: 'https://github.com/whyttaker' },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/whittaker-worland-8360ab235/',
  },
  { label: 'Discord', href: 'https://discord.com/users/288150793444655104' },
] as const;

export const nav = [
  { label: 'Work', href: '/#work' },
  { label: 'Experience', href: '/#experience' },
  { label: 'About', href: '/#about' },
  { label: 'Stack', href: '/#stack' },
  { label: 'Contact', href: '/#contact' },
] as const;

/* The six domains etched into the hero plates. Each carries one real number
   pulled from the work below — the object is made of the resume. */
export const strata = [
  { id: 'systems', label: 'Distributed Systems', metric: '100M+ requests / day' },
  { id: 'cloud', label: 'Cloud Infrastructure', metric: '$2.76M / yr reduced' },
  { id: 'ai', label: 'AI & LLM', metric: '~95% faster response' },
  { id: 'fullstack', label: 'Full-Stack', metric: 'Epic FHIR · EHR tooling' },
  { id: 'game', label: 'Game Systems', metric: '1st place — UCI' },
  { id: 'product', label: 'Product', metric: '200+ client teams' },
] as const;
