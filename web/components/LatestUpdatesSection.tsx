'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface UpdateNotice {
  id: string;
  cycleId: string;
  examName: string;
  conductingBody: string;
  bodyColor: string;
  title: string;
  category: 'notification' | 'admit_card' | 'result';
  when: string;
}

interface ColumnProps {
  title: string;
  icon: string;
  items: UpdateNotice[];
  bgColor: string;
  borderColor: string;
}

function NoticeCard({ notice }: { notice: UpdateNotice }) {
  return (
    <Link href={`/exam/${notice.cycleId}/`}>
      <div className="notice-card">
        <div className="notice-header">
          <div className="exam-tag" style={{ borderColor: notice.bodyColor }}>
            <span className="exam-name">{notice.examName}</span>
          </div>
          <span className="when-text">{notice.when}</span>
        </div>
        <div className="notice-content">
          <h4 className="notice-title">{notice.title}</h4>
          <p className="notice-body">{notice.conductingBody}</p>
        </div>
      </div>
    </Link>
  );
}

function UpdateColumn({ title, icon, items, bgColor, borderColor }: ColumnProps) {
  return (
    <div className="update-column">
      <div className="column-header" style={{ backgroundColor: bgColor }}>
        <span className="column-icon">{icon}</span>
        <h3 className="column-title">{title}</h3>
        <span className="item-count">{items.length}</span>
      </div>
      <div className="column-divider" style={{ backgroundColor: borderColor }}></div>
      <div className="notices-container">
        {items.length > 0 ? (
          items.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))
        ) : (
          <div className="empty-state">
            <p>No updates at the moment</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LatestUpdatesSection({ updates }: { updates: UpdateNotice[] }) {
  const notifications = updates.filter((u) => u.category === 'notification');
  const admitCards = updates.filter((u) => u.category === 'admit_card');
  const results = updates.filter((u) => u.category === 'result');

  return (
    <div className="latest-updates-section">
      <div className="updates-grid">
        <UpdateColumn
          title="Notifications"
          icon="📢"
          items={notifications}
          bgColor="var(--blue-soft)"
          borderColor="var(--blue-medium)"
        />
        <UpdateColumn
          title="Admit Card"
          icon="🎫"
          items={admitCards}
          bgColor="var(--brand-soft)"
          borderColor="var(--brand-medium)"
        />
        <UpdateColumn
          title="Results & Keys"
          icon="🏆"
          items={results}
          bgColor="var(--green-soft)"
          borderColor="var(--green-medium)"
        />
      </div>
    </div>
  );
}
