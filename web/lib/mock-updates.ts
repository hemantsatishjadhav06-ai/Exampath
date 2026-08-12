import type { UpdateNotice } from '@/components/LatestUpdatesSection';

// Mock data for Latest Updates
export const MOCK_UPDATES: UpdateNotice[] = [
  // Notifications
  {
    id: 'notif-1',
    cycleId: 'ssc-cgl-2026',
    examName: 'SSC CGL',
    conductingBody: 'Staff Selection Commission',
    bodyColor: '#FF6B35',
    title: 'Registration Window Extended',
    category: 'notification',
    when: '2h ago',
  },
  {
    id: 'notif-2',
    cycleId: 'upsc-cse-2026',
    examName: 'UPSC CSE',
    conductingBody: 'Union Public Service Commission',
    bodyColor: '#004E89',
    title: 'Syllabus Updated for 2026',
    category: 'notification',
    when: '5h ago',
  },
  {
    id: 'notif-3',
    cycleId: 'ibps-po-2026',
    examName: 'IBPS PO',
    conductingBody: 'Institute of Banking Personnel Selection',
    bodyColor: '#1B8A8A',
    title: 'Important Notice Regarding Exam Centers',
    category: 'notification',
    when: '1d ago',
  },
  {
    id: 'notif-4',
    cycleId: 'ssc-chsl-2026',
    examName: 'SSC CHSL',
    conductingBody: 'Staff Selection Commission',
    bodyColor: '#FF6B35',
    title: 'Final Answer Key Released',
    category: 'notification',
    when: '2d ago',
  },

  // Admit Cards
  {
    id: 'admit-1',
    cycleId: 'rrb-ntpc-2026',
    examName: 'RRB NTPC',
    conductingBody: 'Railway Recruitment Board',
    bodyColor: '#E63946',
    title: 'Admit Card Download Started',
    category: 'admit_card',
    when: '3h ago',
  },
  {
    id: 'admit-2',
    cycleId: 'mppsc-ss-2026',
    examName: 'MPPSC SSE',
    conductingBody: 'Madhya Pradesh Public Service Commission',
    bodyColor: '#A23B72',
    title: 'Regional City Information Released',
    category: 'admit_card',
    when: '1d ago',
  },
  {
    id: 'admit-3',
    cycleId: 'upsc-ias-2026',
    examName: 'UPSC IAS',
    conductingBody: 'Union Public Service Commission',
    bodyColor: '#004E89',
    title: 'City Preferences Link Available',
    category: 'admit_card',
    when: '2d ago',
  },
  {
    id: 'admit-4',
    cycleId: 'ssc-je-2026',
    examName: 'SSC JE',
    conductingBody: 'Staff Selection Commission',
    bodyColor: '#FF6B35',
    title: 'Admit Card for Tier-1 Released',
    category: 'admit_card',
    when: '3d ago',
  },

  // Results
  {
    id: 'result-1',
    cycleId: 'ssc-cgl-2026',
    examName: 'SSC CGL',
    conductingBody: 'Tier-2 Result Declared',
    bodyColor: '#FF6B35',
    title: 'Tier-2 Result & Answer Key Published',
    category: 'result',
    when: '4h ago',
  },
  {
    id: 'result-2',
    cycleId: 'ibps-clerk-2025',
    examName: 'IBPS Clerk',
    conductingBody: 'Answer Key & Provisional Results',
    bodyColor: '#1B8A8A',
    title: 'Mains Answer Key Released',
    category: 'result',
    when: '1d ago',
  },
  {
    id: 'result-3',
    cycleId: 'neet-ug-2026',
    examName: 'NEET UG',
    conductingBody: 'National Eligibility cum Entrance Test',
    bodyColor: '#6A4C93',
    title: 'Result Announcement Date Confirmed',
    category: 'result',
    when: '2d ago',
  },
  {
    id: 'result-4',
    cycleId: 'jee-main-2026',
    examName: 'JEE Main',
    conductingBody: 'January Exam Results Published',
    bodyColor: '#D62828',
    title: 'Session 2 Answer Key Available',
    category: 'result',
    when: '3d ago',
  },
];

export function getMockUpdatesByCategory(category: 'notification' | 'admit_card' | 'result') {
  return MOCK_UPDATES.filter((update) => update.category === category);
}

export function getAllMockUpdates() {
  return MOCK_UPDATES;
}
