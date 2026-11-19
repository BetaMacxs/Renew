import type { SettingsInput } from "@/lib/domain/settings";

/**
 * Detail Corner demo store settings: South African automotive detailing and car-care store.
 *
 * Contains no real contact details (.example email domain, empty WhatsApp number
 * so WhatsApp checkout runs in demo mode until configured).
 */
export const DEMO_SETTINGS: SettingsInput = {
  store: {
    name: "Detail Corner",
    tagline: "The Art of Perfection",
    description:
      "Detail Corner is South Africa's independent store for professional automotive detailing products, wash chemicals and maintenance accessories — chosen for performance, safety and finish.",
    logoUrl: "",
    language: "en",
    currency: "ZAR",
    siteUrl: "",
  },
  contact: {
    email: "hello@detailcorner.example",
    phone: "",
    whatsapp: "",
    address: "",
    hours: "Monday to Friday, 8:00–17:00",
  },
  social: {},
  checkout: {
    whatsapp: true,
    cashOnDelivery: true,
    bankTransfer: true,
    bankTransferInstructions:
      "Account name: Detail Corner (demo)\nBank: Standard Bank\nAccount number: replace with your own details in Settings → Checkout\n\nYour order ships as soon as the transfer arrives.",
    confirmationNote: "We confirm every order by phone or WhatsApp within one business day.",
  },
  shipping: {
    methods: [
      {
        id: "standard",
        name: "Standard courier",
        description: "3–5 business days across South Africa",
        price: 100,
        requiresAddress: true,
      },
      {
        id: "express",
        name: "Express courier",
        description: "1–2 business days",
        price: 180,
        requiresAddress: true,
      },
      {
        id: "pickup",
        name: "Studio pickup",
        description: "Ready the next business day",
        price: 0,
        requiresAddress: false,
      },
    ],
    freeShippingThreshold: 1000,
    areas: "South Africa",
  },
  theme: {
    accent: "#C41E3A",
    fontPairing: "signage",
    corners: "soft",
  },
  homepage: {
    announcement: {
      enabled: true,
      text: "Free delivery on orders over R1,000 across South Africa",
      href: "/shop",
    },
    hero: {
      enabled: true,
      eyebrow: "Professional car care",
      heading: "The Art of Detailing Perfection",
      text: "Premium car shampoos, ceramic sealants, microfibre towels and detailing gear delivered to your door. Fewer, better products for your vehicle.",
      imageUrl: "/demo/hero/hero-1.jpg",
      primaryLabel: "Shop all products",
      primaryHref: "/shop",
      secondaryLabel: "Explore Wash & Decon",
      secondaryHref: "/collections/wash-decon",
    },
    sections: [
      { id: "categories", type: "categories", enabled: true, title: "Shop by category" },
      {
        id: "featured",
        type: "products",
        enabled: true,
        title: "Most loved",
        source: "featured",
        collectionId: null,
        limit: 8,
      },
      {
        id: "gift-banner",
        type: "banner",
        enabled: true,
        eyebrow: "Wash & Decontamination",
        heading: "Safe wash essentials",
        text: "Professional pre-wash snow foams, pH-neutral shampoos and plush wash mitts to protect your paintwork from swirl marks.",
        imageUrl: "/demo/banners/gift-guide.jpg",
        linkLabel: "Shop Wash & Decon",
        linkHref: "/collections/wash-decon",
        align: "start",
      },
      {
        id: "desk",
        type: "products",
        enabled: true,
        title: "Interior & Glass",
        source: "collection",
        collectionId: "de000000-0000-4000-8000-a00000000002",
        limit: 4,
      },
      { id: "highlights", type: "highlights", enabled: true },
      {
        id: "new",
        type: "products",
        enabled: true,
        title: "Just in",
        source: "new",
        collectionId: null,
        limit: 4,
      },
    ],
  },
  policies: {
    about:
      "Detail Corner is a demo store showcasing professional automotive car-care ecommerce. Every product, price and photo here is sample content — replace it with your own from the dashboard.\n\nWe believe in quality chemicals and correct wash techniques to keep every vehicle looking its absolute best.",
    shipping:
      "We deliver Monday to Friday across South Africa.\n\n- Standard courier: 3–5 business days, R100\n- Express courier: 1–2 business days, R180\n- Studio pickup: free, ready the next business day\n\nDelivery is free on orders over R1,000. We confirm every order with you before it ships.",
    returns:
      "Changed your mind? Return unused items within 30 days for a refund or an exchange.\n\nContact us with your order number and we'll arrange the return. Items must be unused and in their original packaging. Chemical products can only be returned unopened and sealed.",
    privacy:
      "We only collect what we need to deliver your order: your name, phone number, delivery address and email.\n\nWe use these details to confirm, deliver and support your order — never for advertising, and we never sell them. We don't use tracking cookies. To see or delete the details we hold about you, contact us.",
  },
};
