export interface Experience {
  company: string;
  title: string;
  dateRange: string;
  bullets: string[];
}

export interface Education {
  school: string;
  degree: string;
  dateRange: string;
  achievements: string[];
  affiliatedUniversity?: string;
}

export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  accentColor: string;
  resumeUrl: string;
  social: {
    email: string;
    linkedin: string;
    github: string;
  };
  aboutMe: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
}

// Populated from Pushpendra Singh's verified resume (Milestone 5).
export const siteConfig: SiteConfig = {
  name: "Pushpendra Singh",
  title: "React Native Developer | Software Engineer",
  description:
    "Portfolio of Pushpendra Singh, a React Native Developer and Software Engineer with 4.6+ years of experience building production mobile applications for Android and iOS.",
  accentColor: "#a8531f",
  resumeUrl: "/Pushpendra-Singh-Resume.pdf",
  social: {
    email: "pushpendra.devera@gmail.com",
    linkedin: "https://www.linkedin.com/in/pushpendra-singh-devera/",
    github: "https://github.com/pushpendra-devera",
  },
  aboutMe:
    "React Native Developer with 4.6 years of experience building production mobile applications for Android and iOS. Strong in React Native, TypeScript, API integration, native platform integrations, real-time communication, push notifications, analytics, performance optimization, and release workflows. Core contributor to Dallal Real Estate Marketplace, a bilingual Kuwait-focused mobile app published on the App Store and Google Play with property search, listing, messaging, calling, verification, maps, analytics, and OTA release support.",
  skills: [
    "React Native",
    "TypeScript",
    "React",
    "JavaScript ES6+",
    "React Navigation",
    "TanStack React Query",
    "Zustand",
    "Redux Toolkit",
    "REST APIs",
    "Firebase",
    "CometChat",
    "Jest",
    "React Testing Library",
    "GitHub Actions",
    "Android",
    "iOS",
  ],
  experience: [
    {
      company: "Cognith",
      title: "React Native Developer",
      dateRange: "January 2026 - Present",
      bullets: [
        "Core contributor to Dallal Real Estate Marketplace, a bilingual React Native app published on App Store and Google Play with 75+ screens and 33 feature modules across property search, listing, chat, calling, broker verification, analytics, and release workflows.",
        "Built voice/video calling using CometChat Calls SDK with iOS CallKit, Android ConnectionService, FCM, Notifee, and PushKit VoIP for incoming call handling across foreground, background, and killed-app states.",
        "Implemented a multi-step property listing wizard with PACI address autofill, OCR-based civil ID parsing, AI-generated descriptions, media upload, validation, and 30+ tracked analytics events.",
        "Designed and maintained a centralized Axios API client with JWT token injection, 401 refresh-token retry logic, request cancellation, and migration support across 100+ REST endpoints.",
        "Delivered English/Arabic localization with i18next and reusable RTL layout helpers for property search, listing, chat, and profile workflows.",
        "Improved performance and stability using memoization, pagination, lazy loading, map marker stabilization, gallery flicker fixes, font bundle cleanup, Sentry, and Firebase Crashlytics.",
        "Supported App Store, Google Play, CI/CD, and OTA release workflows using GitHub Actions, TypeScript checks, Jest, React Testing Library, ESLint, lefthook, and hot-update channels.",
      ],
    },
    {
      company: "Belgium WebNet Inc.",
      title: "React Native Developer",
      dateRange: "December 2024 - December 2025",
      bullets: [
        "Developed React Native features across media, e-commerce, and service workflows using TypeScript, JavaScript, Redux Toolkit, REST APIs, and reusable component patterns.",
        "Integrated media playback, push notifications, profile and content workflows, search/filter flows, cart management, checkout, and Stripe payment handling.",
        "Improved app responsiveness through component reuse, state management cleanup, API loading/error handling, device testing, and UI performance fixes.",
        "Collaborated with backend, QA, design, and product teams to ship Android/iOS features, investigate production issues, and support release readiness.",
      ],
    },
    {
      company: "Metafic",
      title: "Software Engineer",
      dateRange: "January 2022 - November 2024",
      bullets: [
        "Built cross-platform mobile applications using React Native, React, TypeScript, JavaScript, and REST API integrations for Android and iOS.",
        "Developed reusable UI components and modular screens for product catalog, cart, checkout, search, scheduling, authentication, and notification workflows.",
        "Integrated Firebase authentication, analytics, Crashlytics, push notifications, third-party APIs, and secure storage patterns across mobile projects.",
        "Used Jest, React Testing Library, Postman, Android Studio, and Xcode to validate features, debug platform issues, and improve release quality.",
      ],
    },
  ],
  education: [
    {
      school: "Acropolis Institute of Technology and Research, Indore, India",
      degree: "MCA",
      dateRange: "2020 - 2022",
      achievements: [],
      affiliatedUniversity:
        "Rajiv Gandhi Proudyogiki Vishwavidyalaya (RGPV), Bhopal",
    },
    {
      school: "St. Paul Institute of Professional Studies, Indore, India",
      degree: "B.Sc. (Computer Science)",
      dateRange: "2017 - 2020",
      achievements: [],
      affiliatedUniversity: "Devi Ahilya Vishwavidyalaya (DAVV), Indore",
    },
  ],
};
