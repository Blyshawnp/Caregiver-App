/**
 * Minimal i18n. No external dependencies. Translations are typed so a missing
 * key in Spanish is a compile error.
 *
 * Adding a string:
 *   1. Add the key + English value to `en` below.
 *   2. Add the same key with the Spanish value to `es`.
 *   3. Use `t("your.key", lang)` in your component.
 *
 * The user's language preference lives on `profiles.language`. Server pages
 * read it from the profile; client components receive it as a prop.
 */

export type Lang = "en" | "es";

const en = {
  // Nav
  "nav.home": "Home",
  "nav.schedule": "Schedule",
  "nav.tasks": "Tasks",
  "nav.clients": "Clients",
  "nav.team": "Team",
  "nav.notifications": "Alerts",
  "nav.messages": "Messages",
  "nav.me": "Me",

  "auth.title": "Caregiver App",
  "auth.signInTitle": "Sign in to your account",
  "auth.emailOrUsername": "Email or username",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing in...",
  "auth.forgotPassword": "Forgot your password?",
  "auth.backToSignIn": "Back to sign in",
  "auth.needAccess": "Need access? Ask your administrator to add you.",
  "header.welcome": "Welcome",
  "header.profile": "Profile",
  "header.emergencyInfo": "Emergency info",
  "header.notifications": "Notifications",

  // Common
  "common.save": "Save",
  "common.saving": "Saving...",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.loading": "Loading...",
  "common.required": "required",
  "common.optional": "optional",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",
  "common.add": "Add",

  // Me page
  "me.title": "Me",
  "me.email": "Email",
  "me.phone": "Phone",
  "me.organization": "Organization",
  "me.notSet": "Not set",
  "me.signOut": "Sign out",
  "me.helpAndHowTo": "Help & how-to",
  "me.myInvoices": "My invoices",
  "me.payroll": "Payroll",
  "me.manageTeam": "Manage team",
  "me.clientsAndGeofence": "Clients & geofence",
  "me.homeInfo": "Home info",
  "me.settings": "Settings",
  "me.language": "Language",
  "me.languageEn": "English",
  "me.languageEs": "Español",
  "me.languageSubtitle": "Changes take effect on next page load.",

  // Pay summary
  "pay.thisPeriod": "This pay period",
  "pay.lastPeriod": "Last period",
  "pay.runsFriToFri": "Periods run Fri – Fri, lock at 9 PM.",
  "pay.viewAll": "View all →",
  "pay.hours": "hrs",

  // Shift detail
  "shift.scheduled": "Scheduled",
  "shift.notYetStarted": "Not yet started",
  "shift.inProgress": "In progress",
  "shift.completed": "Completed",
  "shift.flagged": "Flagged",
  "shift.client": "Client",
  "shift.caregiver": "Caregiver",
  "shift.location": "Location",
  "shift.bonus": "Bonus",
  "shift.pay": "Pay",
  "shift.checkIn": "Check in",
  "shift.checkOut": "Check out",
  "shift.tasks": "Tasks",
  "shift.viewAllTasks": "View all {n} tasks →",
  "shift.handoffNote": "Handoff note",
  "shift.handoffNoteFromLast": "Note from last shift",
  "shift.handoffNotePlaceholder": "Anything the next caregiver should know? (optional)",
  "shift.leaveHandoffNote": "Leave a note for the next caregiver",
  "shift.viewedBy": "Seen by {name}",
  "shift.notYetViewed": "Not yet seen",

  "task.required": "Required",
  "task.optional": "Optional",
  "task.prn": "PRN",
  "task.importance": "Importance",
  "task.importanceLow": "Low",
  "task.importanceMedium": "Medium",
  "task.importanceHigh": "High",
  "task.importanceCritical": "Critical",
  "task.timeMode": "Time",
  "task.timeOfDay": "Time of day",
  "task.exactTime": "Exact time",
  "task.unscheduled": "Unscheduled",
  "task.morning": "Morning",
  "task.earlyAfternoon": "Early afternoon",
  "task.lateAfternoon": "Late afternoon",
  "task.evening": "Evening",
  "task.bedtime": "Bedtime",
  "task.allowRepeat": "Allow repeat",
  "task.single": "Single",
  "task.manualOrder": "Manual order",
  "task.group.unscheduled": "Unscheduled",
  "task.occurrence": "Occurrence {n}",

  // Help
  "help.title": "Help",
  "help.backLink": "← Back",

  // Messages
  "messages.title": "Messages",
  "messages.newMessage": "New message",
  "messages.send": "Send",
  "messages.typeMessage": "Type a message...",

  // Schedule
  "schedule.title": "Schedule",
  "schedule.today": "Today",
  "schedule.tomorrow": "Tomorrow",
  "schedule.upcoming": "Upcoming",
  "schedule.past": "Past",
  "schedule.noShifts": "No shifts scheduled.",
  "schedule.newShift": "New shift",

  // Roles
  "role.admin": "Admin",
  "role.client": "Client",
  "role.caregiver": "Caregiver",
  "role.family": "Family",
} as const;

type TranslationKey = keyof typeof en;

const es: Record<TranslationKey, string> = {
  "nav.home": "Inicio",
  "nav.schedule": "Horario",
  "nav.tasks": "Tareas",
  "nav.clients": "Clientes",
  "nav.team": "Equipo",
  "nav.notifications": "Avisos",
  "nav.messages": "Mensajes",
  "nav.me": "Yo",

  "auth.title": "Aplicación del cuidador",
  "auth.signInTitle": "Inicie sesión en su cuenta",
  "auth.emailOrUsername": "Correo electrónico o nombre de usuario",
  "auth.password": "Contraseña",
  "auth.signIn": "Iniciar sesión",
  "auth.signingIn": "Iniciando sesión...",
  "auth.forgotPassword": "¿Olvidó su contraseña?",
  "auth.backToSignIn": "Volver a iniciar sesión",
  "auth.needAccess": "¿Necesita acceso? Pida a su administrador que lo agregue.",
  "header.welcome": "Bienvenido",
  "header.profile": "Perfil",
  "header.emergencyInfo": "Información de emergencia",
  "header.notifications": "Notificaciones",

  "common.save": "Guardar",
  "common.saving": "Guardando...",
  "common.cancel": "Cancelar",
  "common.back": "Atrás",
  "common.loading": "Cargando...",
  "common.required": "obligatorio",
  "common.optional": "opcional",
  "common.delete": "Eliminar",
  "common.edit": "Editar",
  "common.confirm": "Confirmar",
  "common.yes": "Sí",
  "common.no": "No",
  "common.add": "Agregar",

  "me.title": "Mi cuenta",
  "me.email": "Correo electrónico",
  "me.phone": "Teléfono",
  "me.organization": "Organización",
  "me.notSet": "No establecido",
  "me.signOut": "Cerrar sesión",
  "me.helpAndHowTo": "Ayuda y guía",
  "me.myInvoices": "Mis facturas",
  "me.payroll": "Nómina",
  "me.manageTeam": "Administrar equipo",
  "me.clientsAndGeofence": "Clientes y geocerca",
  "me.homeInfo": "Información del hogar",
  "me.settings": "Configuración",
  "me.language": "Idioma",
  "me.languageEn": "English",
  "me.languageEs": "Español",
  "me.languageSubtitle": "Los cambios surten efecto al recargar la página.",

  "pay.thisPeriod": "Este período de pago",
  "pay.lastPeriod": "Período anterior",
  "pay.runsFriToFri": "Los períodos van de viernes a viernes, se cierran a las 9 PM.",
  "pay.viewAll": "Ver todo →",
  "pay.hours": "h",

  "shift.scheduled": "Programado",
  "shift.notYetStarted": "Aún no comenzado",
  "shift.inProgress": "En curso",
  "shift.completed": "Completado",
  "shift.flagged": "Marcado",
  "shift.client": "Cliente",
  "shift.caregiver": "Cuidador",
  "shift.location": "Ubicación",
  "shift.bonus": "Bono",
  "shift.pay": "Pago",
  "shift.checkIn": "Registrar entrada",
  "shift.checkOut": "Registrar salida",
  "shift.tasks": "Tareas",
  "shift.viewAllTasks": "Ver las {n} tareas →",
  "shift.handoffNote": "Nota de relevo",
  "shift.handoffNoteFromLast": "Nota del último turno",
  "shift.handoffNotePlaceholder": "¿Algo que el próximo cuidador deba saber? (opcional)",
  "shift.leaveHandoffNote": "Dejar una nota para el próximo cuidador",
  "shift.viewedBy": "Visto por {name}",
  "shift.notYetViewed": "Aún no visto",

  "task.required": "Requerido",
  "task.optional": "Opcional",
  "task.prn": "PRN",
  "task.importance": "Importancia",
  "task.importanceLow": "Baja",
  "task.importanceMedium": "Media",
  "task.importanceHigh": "Alta",
  "task.importanceCritical": "Crítica",
  "task.timeMode": "Hora",
  "task.timeOfDay": "Momento del día",
  "task.exactTime": "Hora exacta",
  "task.unscheduled": "Sin horario",
  "task.morning": "Mañana",
  "task.earlyAfternoon": "Temprano por la tarde",
  "task.lateAfternoon": "Tarde",
  "task.evening": "Noche",
  "task.bedtime": "Hora de dormir",
  "task.allowRepeat": "Permitir repetición",
  "task.single": "Una sola vez",
  "task.manualOrder": "Orden manual",
  "task.group.unscheduled": "Sin horario",
  "task.occurrence": "Ocurrencia {n}",

  "help.title": "Ayuda",
  "help.backLink": "← Atrás",

  "messages.title": "Mensajes",
  "messages.newMessage": "Nuevo mensaje",
  "messages.send": "Enviar",
  "messages.typeMessage": "Escribir un mensaje...",

  "schedule.title": "Horario",
  "schedule.today": "Hoy",
  "schedule.tomorrow": "Mañana",
  "schedule.upcoming": "Próximos",
  "schedule.past": "Pasados",
  "schedule.noShifts": "No hay turnos programados.",
  "schedule.newShift": "Nuevo turno",

  "role.admin": "Administrador",
  "role.client": "Cliente",
  "role.caregiver": "Cuidador",
  "role.family": "Familia",
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = {
  en,
  es,
};

/**
 * Translate a key. Optional `vars` for {placeholders}.
 * Falls back to English if the language doesn't have the key (shouldn't
 * happen due to typing, but defensive).
 */
export function t(
  key: TranslationKey,
  lang: Lang = "en",
  vars?: Record<string, string | number>
): string {
  let s = dictionaries[lang]?.[key] ?? en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export type { TranslationKey };
