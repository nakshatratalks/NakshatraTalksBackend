## **Product Requirements Document: NakshatraTalks**

**Date:** October 25, 2025

### **1\. Introduction**

#### 

#### **1.1. Overview**

This document outlines the product requirements for "NakshatraTalks," a modern, real-time astrology consultation platform. The project's goal is to develop a robust and scalable application, inspired by the market leader AstroTalk, that connects users with professional astrologers via chat, voice, and video. The initial release will be a Minimum Viable Product (MVP) focused on delivering a high-quality, seamless, and trustworthy consultation experience.

#### **1.2. Problem Statement**

Users seeking astrological guidance often face challenges in finding credible, accessible, and authentic experts. Existing platforms can be plagued by issues of trust, inconsistent quality, and unreliable technology. There is a clear market opportunity for a platform that prioritizes a stringent vetting process for its astrologers and provides a stable, high-performance technical foundation for its services.

#### **1.3. Goal**

The primary goal of the NakshatraTalks MVP is to launch a fully functional marketplace that successfully facilitates one-on-one and group consultations between clients and a curated list of verified astrologers. Success will be defined by the platform's ability to provide a seamless user experience, from onboarding to the completion of a paid session, thereby establishing a foundation of trust and reliability with its initial user base.

### 

### **2\. Technical Specifications**

The application will be built using a modern, scalable, and efficient technology stack to ensure a high-quality experience on both web and mobile platforms.

* **Mobile Application (iOS & Android):**  
  * **Framework:** React Native (enabling a single codebase for both platforms).  
* **Web Application:**  
  * **Framework:** Next.js (for a high-performance, SEO-friendly web experience).  
* **Backend API:**  
  * **Framework:** Express.js (built on Node.js for handling real-time, I/O-intensive operations).  
* **Database:**  
  * **Type:** PostgreSQL (a powerful and reliable open-source relational database).  
  * **Hosting:** Supabase (providing a managed PostgreSQL instance with additional developer-friendly features).  
* **Authentication:**  
  * **Service:** Firebase Authentication (for secure and easy-to-implement user login via mobile number and social providers).  
* **Backend Hosting:**  
  * **Status:** To be finalized.  
  * **Potential Options:** A service that supports long-running, stateful server processes is required for real-time features. Options under consideration include Railway, Render, or a traditional cloud instance (VPS / AWS EC2).  
* **Third-Party Service Integrations:**  
  * **Real-Time Communication (Chat, Voice, Video):** Twilio SDK or Agora SDK  
  * **Payment Gateway:** Razorpay.  
  * **Astrology Calculations & Chart Generation:** A dedicated Astrology API (e.g., Prokerala API).


### **3\. Core Features & Functionality (MVP)**

The MVP will focus on the core consultation experience. All features will be available on both the mobile and web applications.

#### **3.1. User & Astrologer Roles**

The platform will support two distinct user roles:

* **Client:** A user seeking astrological consultation.  
* **Astrologer:** A verified expert providing consultation services. (Note: Astrologer onboarding will be handled via a separate admin panel and is not part of the client-facing app's functionality).

#### 

#### **3.2. Key Feature Set**

1. **User Wallet System:**  
   * The application will operate on a wallet-based model. All payments for consultations are deducted from a user's in-app wallet.  
   * Users can add funds to their wallet using the integrated Razorpay payment gateway.  
   * Recharge options will be available in various denominations (e.g., ₹50, ₹100, ₹200, ₹500).  
   * The wallet will display the current balance and a detailed transaction history.  
2. **Free Horoscope Generator (via Astrology API):**  
   * As an introductory feature, users can get a free, automated horoscope reading.  
   * The user will be prompted to enter their birth details (date, time, place).  
   * The Astrology API will process this information to generate a personalized horoscope, including key planetary positions and their meanings.  
   * This feature is designed as a quick (1-2 minute) engagement tool to demonstrate the value of the platform and act as a funnel towards paid consultations.  
3. **Chat with Astrologer:**  
   * Users can browse a list of available astrologers and initiate a one-on-one text-based chat session.  
   * The session will be billed on a per-minute basis, with the cost deducted directly from the user's wallet balance.  
   * The interface will include a running timer and the accumulating cost of the session for full transparency.  
4. **Call with Astrologer (Voice):**  
   * Users can initiate a private, one-on-one voice call with an available astrologer.  
   * This feature will also be billed per-minute from the user's wallet.  
   * The call interface will include standard controls (mute, speakerphone, end call) and display the session duration and cost.  
5. **Video Call with Astrologer:**  
   * Users can engage in a face-to-face video consultation with an astrologer.  
   * This premium feature will be billed per-minute from the user's wallet.  
   * The interface will include video controls (toggle camera, switch camera) in addition to standard call controls.  
6. **Live Sessions with Astrologers:**  
   * Astrologers can host live, one-to-many video sessions on specific topics (e.g., "Weekly Career Forecast").  
   * Users can join these sessions to watch, listen, and interact via a public chat.  
   * This feature is designed for broader user engagement and to showcase the expertise of the astrologers on the platform.

  7**.   Introductory Chatbot**

* The chatbot will initiate a guided conversation immediately after the **Initial Profile Setup (Screen 4\)** is completed.  
  * It will leverage the user's previously entered **birth details** (date, time, place) to provide a few basic, auto-generated "starter insights."  
  * The conversation will be limited to a fixed number of turns (e.g., 5-7 responses) or a single short, predefined script.  
  * The chatbot's personality will be branded as a "Virtual Astrological Assistant" and will be distinct from a human astrologer.

#### **3.3. Supported Astrology Disciplines**

To cater to a wide range of user interests, astrologers on the platform can be categorized by their specialties. Users will be able to filter and search for experts based on these disciplines:

* Vedic Astrology  
* Tarot Card Reading  
* Numerology  
* Palmistry  
* Face Reading  
* Vastu  
* And other relevant categories.

## 

## **4\. High-Level Product Wireframe & Design System (Only a Proposal can be changed while development)**

### **Core Design System**

* **Color Palette:**  
  * **Primary/Brand Color:** A warm, optimistic yellow (\#FFC107). Used for primary call-to-action (CTA) buttons, active states, and key accents.  
  * **Primary Text Color:** A dark, trustworthy navy blue (\#192A56). Used for headings and body text.  
  * **Background Color:** A clean, soft off-white (\#F8F9FA).  
  * **Success/Online Indicator:** A vibrant green (\#28A745).  
  * **Error/Busy Indicator:** A cautionary red (\#DC3545).  
  * **Neutral/Borders:** A light grey (\#E0E0E0).  
* **Typography:** A modern, readable sans-serif font family like 'Inter' or 'Poppins'.  
* **Iconography:** Clean, universally understood icons (e.g., Material Design Icons).  
* **Status Bar:** Light theme with dark content (icons and text).
