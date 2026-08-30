"use client";

import "react-time-ago/locale/en";

import { useMemo } from "react";
import ReactTimeAgo from "react-time-ago";

import { cn } from "@/lib/utils";

type TimeAgoProps = {
  date: Date | string;
  className?: string;
};

export function TimeAgo({ date, className }: TimeAgoProps) {
  const value = useMemo(
    () => (typeof date === "string" ? new Date(date) : date),
    [date],
  );

  return (
    <>
      <ReactTimeAgo
        date={value}
        locale="en"
        timeStyle="mini-minute"
        className={cn(className, "md:hidden")}
      />
      <ReactTimeAgo
        date={value}
        locale="en"
        timeStyle="round-minute"
        className={cn(className, "hidden md:inline")}
      />
    </>
  );
}
