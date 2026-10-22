import React from "react";
import type { Metadata } from "next";
import { IntroView } from "./intro-view";

export const metadata: Metadata = {
  title: "About BookHive | STI West Negros University Library",
  description:
    "Introduction to BookHive — the smart library management system for STI West Negros University. Discover AI catalog search, easy book reservations, and digital library cards.",
};

export default function IntroPage() {
  return <IntroView />;
}
