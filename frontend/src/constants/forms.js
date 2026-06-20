export const emptyCompanyForm = { name: "", slug: "", description: "" };

export const emptyWhatsAppForm = {
  phoneNumberId: "",
  accessToken: "",
  isActive: true,
};

export const emptySmsForm = {
  accountSid: "",
  authToken: "",
  phoneNumber: "",
  isActive: true,
};

export const emptyLoginForm = { email: "", password: "" };

export const emptyAdminForm = {
  name: "",
  email: "",
  password: "",
  role: "company_admin",
  companyId: "",
};

export const widgetEmbedModeOptions = [
  {
    value: "all",
    label: "All Login Options",
  },
  {
    value: "external",
    label: "Company Account Login Only",
  },
  {
    value: "google",
    label: "Google Auth Login Only",
  },
  {
    value: "guest",
    label: "Without Login Only",
  },
];
