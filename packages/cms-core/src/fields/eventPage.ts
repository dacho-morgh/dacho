import type { Field, TextField, UploadField } from "payload";

const text = (name: string, defaultValue?: string): TextField => ({
  name,
  type: "text",
  defaultValue,
});
const image = (name: string): UploadField => ({ name, type: "upload", relationTo: "media" });
const heading = (title: string, description = ""): Field[] => [
  { name: "enabled", type: "checkbox", defaultValue: true },
  text("title", title),
  { name: "description", type: "textarea", defaultValue: description },
];
const sectionDescription =
  "ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.";

export const eventPageFields: Field[] = [
  {
    name: "showOnEventsPage",
    type: "checkbox",
    defaultValue: false,
    label: "Feature on /events",
    admin: {
      description:
        "Featured events appear first in the /events listing. Each item opens its own event details.",
    },
  },
  {
    name: "registration",
    type: "group",
    label: "Hero registration button",
    fields: [
      { name: "enabled", type: "checkbox", defaultValue: true },
      text("label", "ثبت نام در رویداد"),
      text("href", "/dashboard/events"),
    ],
  },
  {
    name: "countdown",
    type: "group",
    fields: [
      { name: "enabled", type: "checkbox", defaultValue: true },
      {
        name: "targetDate",
        type: "date",
        admin: {
          date: { pickerAppearance: "dayAndTime" },
          description: "Leave empty to count down to Start Date.",
        },
      },
      text("label", "زمان باقی‌مانده تا رویداد"),
      text("daysLabel", "روز"),
      text("hoursLabel", "ساعت"),
      text("minutesLabel", "دقیقه"),
      text("secondsLabel", "ثانیه"),
    ],
  },
  {
    name: "metadata",
    type: "group",
    label: "Date, time and location labels",
    fields: [
      { name: "enabled", type: "checkbox", defaultValue: true },
      text("label", "مشخصات رویداد"),
      text("dateLabel", "تاریخ برگزاری"),
      text("timeLabel", "ساعت برگزاری"),
      text("locationLabel", "محل برگزاری"),
      text("typeLabel", "نوع رویداد"),
      text("eventType", "رویداد تخصصی"),
      text("timeSeparator", "تا"),
      {
        ...text("dateText"),
        admin: {
          description:
            "Optional custom date text; otherwise calculated from start/end dates in Tehran time.",
        },
      },
      {
        ...text("timeText"),
        admin: {
          description:
            "Optional custom time text; otherwise calculated from start/end dates in Tehran time.",
        },
      },
    ],
  },
  {
    name: "about",
    type: "group",
    fields: [
      ...heading("درباره این رویداد"),
      image("image"),
      {
        name: "paragraphs",
        type: "array",
        fields: [{ name: "text", type: "textarea", required: true }],
      },
    ],
  },
  {
    name: "opportunities",
    type: "group",
    fields: [
      ...heading("این رویداد چه فرصتی برای شما ایجاد می‌کند؟", sectionDescription),
      image("image"),
      {
        name: "items",
        type: "array",
        fields: [text("title"), { name: "description", type: "textarea" }],
        defaultValue: [
          {
            title: "ارتباط مستقیم با صنعت",
            description: "امکان ارائه راهکار و مذاکره مستقیم با مدیران و کارشناسان صنایع مرتبط.",
          },
          { title: "معرفی توانمندی‌ها" },
          { title: "شناسایی فرصت‌های همکاری" },
          { title: "توسعه بازار" },
        ],
      },
    ],
  },
  {
    name: "audience",
    type: "group",
    fields: [
      ...heading(
        "مخاطبان رویداد",
        "این رویداد برای شرکت‌های دانش‌بنیان، فناور و مجموعه‌هایی طراحی شده است که راهکار، محصول یا فناوری مرتبط با نیازهای صنعت انرژی ارائه می‌کنند.",
      ),
      {
        name: "items",
        type: "array",
        fields: [text("title")],
        defaultValue: ["شرکت‌های دانش‌بنیان", "شرکت‌های فناور", "استارتاپ‌ها", "تیم‌های نوآور"].map(
          (title) => ({ title }),
        ),
      },
    ],
  },
  {
    name: "steps",
    type: "group",
    label: "Registration steps",
    fields: [
      ...heading("مراحل شرکت در رویداد", sectionDescription),
      {
        name: "items",
        type: "array",
        fields: [text("title"), { name: "description", type: "textarea" }],
        defaultValue: [
          { title: "ثبت نام", description: "اطلاعات شرکت و نماینده خود را ثبت کنید." },
          {
            title: "ارسال اطلاعات و رزومه",
            description: "توانمندی‌ها، محصولات و سوابق مرتبط خود را معرفی کنید.",
          },
          {
            title: "بررسی و ارزیابی",
            description: "اطلاعات ارسالی توسط تیم برگزارکننده بررسی می‌شود.",
          },
          { title: "اعلام نتایج", description: "نتیجه بررسی و نحوه حضور به شرکت اطلاع داده می‌شود." },
        ],
      },
    ],
  },
  {
    name: "guests",
    type: "group",
    fields: [
      ...heading("مهمانان رویداد", sectionDescription),
      { name: "items", type: "array", fields: [text("name"), text("role"), image("image")] },
    ],
  },
  {
    name: "sponsors",
    type: "group",
    fields: [
      ...heading("حامیان", "حامیان پیشرو در صنعت کشور"),
      { name: "items", type: "array", fields: [text("name"), image("logo"), text("href")] },
    ],
  },
  {
    name: "gallery",
    type: "group",
    fields: [
      ...heading("گالری تصاویر", "لحظاتی از رویداد های پیشین"),
      { name: "items", type: "array", fields: [{ ...image("image"), required: true }] },
    ],
  },
  {
    name: "schedule",
    type: "group",
    fields: [
      ...heading("برنامه رویداد", "این رویداد برای شرکت‌های دانش‌بنیان،"),
      {
        name: "buttons",
        type: "array",
        fields: [
          text("label"),
          text("href"),
          { name: "primary", type: "checkbox", defaultValue: false },
        ],
      },
      {
        name: "items",
        type: "array",
        fields: [text("time"), text("title"), { name: "description", type: "textarea" }],
      },
    ],
  },
  {
    name: "venue",
    type: "group",
    fields: [
      ...heading("اطلاعات برگزاری"),
      image("mapImage"),
      text("locationLabel", "محل"),
      text("addressLabel", "آدرس"),
      text("dateLabel", "تاریخ برگزاری"),
      { ...text("address"), admin: { description: "Leave empty to use the event location." } },
      text("mapHref"),
    ],
  },
  {
    name: "callToAction",
    type: "group",
    fields: [
      ...heading(
        "مشتاق همکاری با شما هستیم",
        "در صورت تمایل به همکاری با کارخانه نوآوری صنایع انرژی بوشهر رزومه خود را برای ما بفرستید.",
      ),
      text("buttonLabel", "ارسال رزومه"),
      text("buttonHref", "/cooperation"),
      image("backgroundImage"),
    ],
  },
  {
    name: "faq",
    type: "group",
    fields: [
      ...heading(
        "سوالات پر تکرار",
        "از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه مدیریت می‌شود.",
      ),
      {
        name: "items",
        type: "array",
        fields: [text("question"), { name: "answer", type: "textarea" }],
      },
    ],
  },
];
