export interface TermSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  rules: string[];
}

export const TERMS_AND_AGREEMENT: TermSection[] = [
  {
    id: "membership",
    title: "1. Library Membership & Card Accountability",
    icon: "card-outline",
    description: "Every officially enrolled student is granted a BookHive digital library card.",
    rules: [
      "Your student library card and ID number are strictly non-transferable. You may not lend or permit another student to use your credentials.",
      "You are solely responsible for all borrowing, reservation, and loan transactions recorded under your account.",
      "Any account discrepancies or lost credentials must be reported immediately to the Library Administration or Super Administrator.",
    ],
  },
  {
    id: "borrowing",
    title: "2. Borrowing Privileges & Loan Policy",
    icon: "book-outline",
    description: "Students in good standing are entitled to borrow available books from the library collection.",
    rules: [
      "Students may borrow approved materials up to the maximum allowable book limit at any given time.",
      "All borrowed books must be checked out through the official BookHive circulation system prior to removal from library premises.",
      "Reference materials, special collections, and reserve shelf books are subject to room-use only restrictions.",
    ],
  },
  {
    id: "due_dates",
    title: "3. Loan Periods, Returns & Due Dates",
    icon: "calendar-outline",
    description: "Materials must be returned promptly on or before the designated due date.",
    rules: [
      "The loan period is strictly tracked by the library system. You are responsible for monitoring your due dates via the mobile app.",
      "Books must be returned to the Circulation Desk or official book return slot during operating hours.",
      "Loan renewals may be granted provided no other student has placed a pending reservation on the title.",
    ],
  },
  {
    id: "penalties",
    title: "4. Overdue Fines & Disciplinary Penalties",
    icon: "alert-circle-outline",
    description: "Failure to return library books on time will result in disciplinary fines and restrictions.",
    rules: [
      "A daily overdue fine (standard penalty rate of ₱20.00 per book/day) is automatically assessed for overdue loans beyond the due date.",
      "Accounts with unresolved overdue penalties will have borrowing, reservation, and clearance signing privileges placed on hold.",
      "Prolonged failure to return library materials will be referred to the Office of Student Affairs for formal disciplinary action.",
    ],
  },
  {
    id: "care_of_books",
    title: "5. Care of Books & Damage/Loss Liability",
    icon: "shield-checkmark-outline",
    description: "Students must maintain borrowed books in pristine and usable condition.",
    rules: [
      "Writing, underlining, highlighting, tearing pages, or defacing books is considered vandalism and strictly prohibited.",
      "In the event of book loss or irreparable damage, the student must either replace the exact edition of the book or reimburse the full replacement cost plus processing fees.",
      "Damaged books must be brought immediately to the circulation librarian for assessment.",
    ],
  },
  {
    id: "reservations",
    title: "6. Reservations & Queueing System",
    icon: "time-outline",
    description: "Reservations are processed on a first-come, first-served basis.",
    rules: [
      "Reserved books that become available must be claimed at the Circulation Desk within the designated claim deadline.",
      "Failure to claim an approved reservation within the deadline window will automatically cancel the reservation and release the book to the next student in queue.",
      "Repeated unclaimed reservations may lead to temporary restriction of online reservation privileges.",
    ],
  },
  {
    id: "conduct",
    title: "7. Library Code of Conduct & Facilities",
    icon: "people-outline",
    description: "All students are expected to uphold academic integrity and quiet study decorum.",
    rules: [
      "Maintain silence in designated quiet study areas; phone calls and loud discussions are strictly prohibited.",
      "Eating and drinking (except covered water bottles) inside the library reading halls are not allowed.",
      "Respect library staff, student assistants, and fellow students at all times.",
    ],
  },
  {
    id: "privacy",
    title: "8. Data Privacy & Account Management",
    icon: "lock-closed-outline",
    description: "Your reading and borrowing history is safeguarded under institutional privacy rules.",
    rules: [
      "Transaction records and checkout logs are collected strictly for circulation monitoring and accreditation statistics.",
      "Only authorized library staff and the Super Administrator have access to modify administrative student records.",
      "Students cannot directly modify core registration information; any corrections must be requested through the Super Admin.",
    ],
  },
];
