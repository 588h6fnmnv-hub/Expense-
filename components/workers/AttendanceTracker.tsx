"use client";

import React from "react";
import type { Attendance, ThemeMode } from "@/lib/types";

type AttendanceTrackerProps = {
  attendance: Attendance[];
  theme: ThemeMode;
};

export default function AttendanceTracker({ attendance, theme }: AttendanceTrackerProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-2">Attendance</h2>
      <div className="grid grid-cols-1 gap-2">
        {attendance.length > 0 ? (
          attendance.map((record) => (
            <div
              key={record.id}
              className={`p-4 rounded-2xl border flex justify-between items-center ${
                theme === "dark" ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
              }`}
            >
              <div>
                <p className="font-bold">{record.workerName}</p>
                <p className="text-xs opacity-50">{record.date}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                record.status === "Present" ? "bg-emerald-500/20 text-emerald-500" : "bg-danger-red/20 text-danger-red"
              }`}>
                {record.status}
              </span>
            </div>
          ))
        ) : (
          <p className="text-center py-8 opacity-40">No attendance records today</p>
        )}
      </div>
    </div>
  );
}
