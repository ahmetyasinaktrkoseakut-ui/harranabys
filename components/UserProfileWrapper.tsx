'use client';

import { useState } from 'react';
import ProfileSettingsClient from './ProfileSettingsClient';

export default function UserProfileWrapper({ 
  userId, 
  userName, 
  initials, 
  translatedRole 
}: { 
  userId: string; 
  userName: string; 
  initials: string; 
  translatedRole: string; 
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <div 
        onClick={() => setIsProfileOpen(true)}
        className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-xl transition-all"
      >
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm tracking-tight border border-slate-200 group-hover:border-indigo-300 group-hover:bg-indigo-50 transition-all">
          {initials}
        </div>
        <div className="text-left flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{userName}</p>
          <p className="text-[11px] text-slate-500 font-medium leading-tight">{translatedRole}</p>
        </div>
      </div>

      <ProfileSettingsClient 
        userId={userId}
        initialName={userName}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
