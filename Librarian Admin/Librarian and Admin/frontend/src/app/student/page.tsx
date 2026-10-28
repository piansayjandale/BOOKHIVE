import React from "react";
import type { Metadata } from "next";
import { StudentView } from "./student-view";

export const metadata: Metadata = {
  title: "Student Companion Portal | BookHive STI WNU Library",
  description:
    "Official BookHive digital student library companion for STI West Negros University. Search catalog, reserve titles, check borrowing deadlines, and view your digital library card.",
};

export default function StudentPage() {
  return <StudentView />;
}
