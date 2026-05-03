export interface Project {
  year: string
  name: string
  status?: string
  category: string
}

export const profile = {
  name: 'Aidar',
  role: 'Designer at Applied AI',
  location: 'Abu Dhabi, UAE',
  timeZone: 'Asia/Dubai',
  bio: "I'm a Designer at Applied AI, focused on taking products from 0→1 and delivering them end-to-end. I simplify complex technical ideas into clear, intuitive experiences, working closely with product and engineering throughout. I care deeply about craft and quality, down to the smallest details.",
  contact: {
    x: {
      label: 'X (@aidar)',
      href: 'https://x.com/aidar',
    },
    telegram: {
      label: 'Telegram',
      href: 'https://t.me/aidar',
    },
    email: {
      label: 'email me',
      href: 'mailto:hi@aidar.su',
    },
  },
  projects: [
    { year: '2026', name: 'Applied AI - Opus', status: 'Coming Soon', category: 'AI Workflow Automation' },
    { year: '2025', name: 'Mitosis', status: 'Coming Soon', category: 'Decentralized Finance' },
    { year: '2024', name: 'Digital Asset Risk Tracker', category: 'Blockchain Security' },
    { year: '2024', name: 'Xint', category: 'Cloud Security' },
    { year: '2024', name: 'Zenguard AI', category: 'GenAI Security' },
    { year: '2022', name: 'Octet', category: 'Blockchain Infrastructure' },
  ] satisfies Project[],
  stats: {
    visitors: '3,400',
    lastViewed: 'London, UK',
  },
}
