// UI strings for the twelve output languages.
// The `api` name is what the server/Gemini is told to answer in; `label` is shown in the picker
// in the language's own script; `tts` is the BCP-47 tag used for speech and speech recognition.
//
// Long-form content (diagnosis, treatment) is written by Gemini in the chosen language.
// Everything below is the interface itself, so a user who cannot read English can still use the app.
// Translations for yo/ig/ha/pidgin were written in-house; a native speaker should still review
// them before the demo. Keys missing from a language fall back to English on purpose.

export const LANGUAGES = [
  { api: "English", label: "English", short: "EN", tts: "en-US", locale: "en-US", rtl: false },
  { api: "Yoruba", label: "Yorùbá", short: "YO", tts: "yo-NG", locale: "yo-NG", rtl: false },
  { api: "Hausa", label: "Hausa", short: "HA", tts: "ha-NG", locale: "ha-NG", rtl: false },
  { api: "Igbo", label: "Igbo", short: "IG", tts: "ig-NG", locale: "ig-NG", rtl: false },
  { api: "Nigerian Pidgin", label: "Naijá", short: "NAI", tts: "en-NG", locale: "en-NG", rtl: false },
  { api: "French", label: "Français", short: "FR", tts: "fr-FR", locale: "fr-FR", rtl: false },
  { api: "Spanish", label: "Español", short: "ES", tts: "es-ES", locale: "es-ES", rtl: false },
  { api: "Portuguese", label: "Português", short: "PT", tts: "pt-BR", locale: "pt-BR", rtl: false },
  { api: "Arabic", label: "العربية", short: "AR", tts: "ar-SA", locale: "ar-SA", rtl: true },
  { api: "Hindi", label: "हिन्दी", short: "HI", tts: "hi-IN", locale: "hi-IN", rtl: false },
  { api: "Swahili", label: "Kiswahili", short: "SW", tts: "sw-KE", locale: "sw-KE", rtl: false },
  { api: "Chinese", label: "中文", short: "ZH", tts: "zh-CN", locale: "zh-CN", rtl: false },
];

export const DEFAULT_LANG = "English";

const STRINGS = {
  English: {
    step1: "Add photos", step2: "What have you noticed?", weather: "Use local weather",
    diagnose: "Diagnose", needPhoto: "Add at least one photo to start.",
    retry: "Try again", back: "Back to photos",
    history: "Past scans", historyEmpty: "No saved scans yet.",
    clear: "Clear history", clearConfirm: "Delete all saved scans from this device?",
    cancel: "Cancel", delete: "Delete", close: "Close",
    listen: "Listen", confidence: "Confidence", notSure: "Not sure yet",
    err_offline: "You are offline. Reconnect, then try again.",
    err_busy: "The AI service is busy. Try again in a moment.",
    err_timeout: "The analysis took too long. Try again.",
    // English-only for now: these fall back here when a language has no entry yet.
    loading1: "Checking photo quality", loading2: "Analysing the photos", loading3: "Writing advice in {language}",
    err_title: "Could not finish", err_network: "We could not reach the server. Check your connection and try again.",
    err_key: "The AI service rejected this app's key. The site owner needs to fix GEMINI_API_KEY, then redeploy.",
    err_model: "The AI model is not available. The site owner needs to set GEMINI_MODEL (for example gemini-3.8-flash).",
    err_access: "This API key is not allowed to use Gemini. The site owner needs to enable it in Google AI Studio.",
    err_quota: "The free AI quota for this app is used up. Try again later.",
    err_request: "The AI service rejected the request. Try a smaller or clearer photo.",
    err_json: "The AI reply could not be read. Try again.",
    err_photo_title: "Try a clearer photo", err_plant_title: "This may not be a plant",
    err_photo_text: "Get closer, use daylight, and keep the leaf sharp.",
    photoHintOne: "{n} of 4 photos. Another angle helps.", photoHintMax: "Maximum of 4 photos.",
    micBlocked: "The microphone is blocked. Allow it in your browser settings, or type your notes.",
    micNoLang: "Voice input is not available for this language on this device. Please type your notes.",
    noVoice: "This device has no {language} voice. The text above is still complete.",
    noSpeak: "This browser cannot read text aloud.",
    popupBlocked: "Allow pop-ups to print the report.",
    icsSaved: "Reminders downloaded. Open the file to add them to your calendar.",
  },
  Yoruba: {
    step1: "Fi àwòrán kún", step2: "Kí ni o kíyèsí?", weather: "Lo ojú-ọjọ́ àdúgbò mi",
    diagnose: "Ṣàyẹ̀wò", needPhoto: "Fi ó kéré tán àwòrán kan kún.",
    retry: "Tún gbìyànjú", back: "Padà sí àwòrán",
    history: "Àwòrán tí ó ti kọjá", historyEmpty: "Kò sí àwòrán tí a fi pamọ́.",
    clear: "Pa ìtàn rẹ́", clearConfirm: "Pa gbogbo àwòrán tí a fi pamọ́ nínú ẹ̀rọ yìí?",
    cancel: "Fagilé", delete: "Pa rẹ́", close: "Tì",
    listen: "Gbọ́", confidence: "Ìgbẹ́kẹ̀lé", notSure: "Kò dájú",
    err_offline: "O kò sí lórí íńtánẹ́ẹ̀tì. Tún sopọ̀ kí o tún gbìyànjú.",
    err_busy: "Iṣẹ́ AI ń ṣiṣẹ́. Tún gbìyànjú lẹ́yìn kékèké.",
    err_timeout: "Ìṣàyẹ̀wò gba àkókò púpọ̀. Tún gbìyànjú.",
  },
  Hausa: {
    step1: "Ƙara hotuna", step2: "Me ka lura da shi?", weather: "Yi amfani da yanayin yankina",
    diagnose: "Bincika", needPhoto: "Ƙara aƙalla hoto ɗaya don farawa.",
    retry: "Sake gwadawa", back: "Koma ga hotuna",
    history: "Hotunan baya", historyEmpty: "Babu hotuna da aka adana.",
    clear: "Share tarihi", clearConfirm: "Share duk hotunan da aka adana a wannan na'ura?",
    cancel: "Soke", delete: "Share", close: "Rufe",
    listen: "Saurara", confidence: "Tabbaci", notSure: "Ba a tabbata ba",
    err_offline: "Ba ka da haɗin yanar gizo. Sake haɗawa sannan ka sake gwadawa.",
    err_busy: "Aikin AI yana aiki. Sake gwadawa cikin ɗan lokaci.",
    err_timeout: "Binciken ya ɗauki lokaci mai tsawo. Sake gwadawa.",
  },
  Igbo: {
    step1: "Tinye foto", step2: "Gịnị ka ị hụrụ?", weather: "Jiri ihu igwe ebe a",
    diagnose: "Nyochaa", needPhoto: "Tinye foto opekata mpe otu iji malite.",
    retry: "Nwaa ọzọ", back: "Laghachi na foto",
    history: "Foto ndị gara aga", historyEmpty: "Enweghị foto echekwara.",
    clear: "Kpochapụ akụkọ", clearConfirm: "Kpochapụ foto niile echekwara na ngwaọrụ a?",
    cancel: "Kagbuo", delete: "Kpochapụ", close: "Mechie",
    listen: "Gee ntị", confidence: "Ntụkwasị obi", notSure: "Amabeghị nke ọma",
    err_offline: "Ị nweghị ịntanetị. Jikọọ ọzọ ma nwaa ọzọ.",
    err_busy: "Ọrụ AI nọ na-arụ ọrụ. Nwaa ọzọ n'oge na-adịghị anya.",
    err_timeout: "Nyocha ahụ were oge dị ogologo. Nwaa ọzọ.",
  },
  "Nigerian Pidgin": {
    step1: "Add photos", step2: "Wetin you notice?", weather: "Use weather for my area",
    diagnose: "Check am", needPhoto: "Add at least one photo before you start.",
    retry: "Try again", back: "Go back to photos",
    history: "Old scans", historyEmpty: "No saved scan dey.",
    clear: "Clear history", clearConfirm: "Delete all the scans wey you save for this phone?",
    cancel: "Leave am", delete: "Delete", close: "Close",
    listen: "Listen", confidence: "How sure", notSure: "No sure yet",
    err_offline: "You no dey online. Connect again make you try.",
    err_busy: "The AI dey busy. Try again small time.",
    err_timeout: "The check take too long. Try again.",
  },
  French: {
    step1: "Ajouter des photos", step2: "Qu'avez-vous remarqué ?", weather: "Utiliser la météo locale",
    diagnose: "Diagnostiquer", needPhoto: "Ajoutez au moins une photo pour commencer.",
    retry: "Réessayer", back: "Retour aux photos",
    history: "Analyses précédentes", historyEmpty: "Aucune analyse enregistrée.",
    clear: "Effacer l'historique", clearConfirm: "Supprimer toutes les analyses enregistrées sur cet appareil ?",
    cancel: "Annuler", delete: "Supprimer", close: "Fermer",
    listen: "Écouter", confidence: "Confiance", notSure: "Pas encore sûr",
    err_offline: "Vous êtes hors ligne. Reconnectez-vous puis réessayez.",
    err_busy: "Le service IA est occupé. Réessayez dans un instant.",
    err_timeout: "L'analyse a pris trop de temps. Réessayez.",
  },
  Spanish: {
    step1: "Añadir fotos", step2: "¿Qué has notado?", weather: "Usar el clima local",
    diagnose: "Diagnosticar", needPhoto: "Añade al menos una foto para empezar.",
    retry: "Reintentar", back: "Volver a las fotos",
    history: "Análisis anteriores", historyEmpty: "Aún no hay análisis guardados.",
    clear: "Borrar historial", clearConfirm: "¿Borrar todos los análisis guardados en este dispositivo?",
    cancel: "Cancelar", delete: "Borrar", close: "Cerrar",
    listen: "Escuchar", confidence: "Confianza", notSure: "Aún no estoy seguro",
    err_offline: "Sin conexión. Vuelve a conectarte e inténtalo otra vez.",
    err_busy: "El servicio de IA está ocupado. Inténtalo en un momento.",
    err_timeout: "El análisis tardó demasiado. Inténtalo otra vez.",
  },
  Portuguese: {
    step1: "Adicionar fotos", step2: "O que você notou?", weather: "Usar o clima local",
    diagnose: "Diagnosticar", needPhoto: "Adicione pelo menos uma foto para começar.",
    retry: "Tentar de novo", back: "Voltar às fotos",
    history: "Análises anteriores", historyEmpty: "Nenhuma análise salva ainda.",
    clear: "Limpar histórico", clearConfirm: "Apagar todas as análises salvas neste aparelho?",
    cancel: "Cancelar", delete: "Apagar", close: "Fechar",
    listen: "Ouvir", confidence: "Confiança", notSure: "Ainda não tenho certeza",
    err_offline: "Você está sem conexão. Conecte-se e tente de novo.",
    err_busy: "O serviço de IA está ocupado. Tente de novo em instantes.",
    err_timeout: "A análise demorou demais. Tente de novo.",
  },
  Arabic: {
    step1: "أضف صورًا", step2: "ماذا لاحظت؟", weather: "استخدم طقس منطقتي",
    diagnose: "افحص", needPhoto: "أضف صورة واحدة على الأقل للبدء.",
    retry: "حاول مرة أخرى", back: "العودة إلى الصور",
    history: "الفحوصات السابقة", historyEmpty: "لا توجد فحوصات محفوظة.",
    clear: "حذف السجل", clearConfirm: "حذف كل الفحوصات المحفوظة على هذا الجهاز؟",
    cancel: "إلغاء", delete: "حذف", close: "إغلاق",
    listen: "استمع", confidence: "درجة الثقة", notSure: "لست متأكدًا بعد",
    err_offline: "أنت غير متصل. أعد الاتصال ثم حاول مرة أخرى.",
    err_busy: "خدمة الذكاء الاصطناعي مشغولة. حاول بعد قليل.",
    err_timeout: "استغرق الفحص وقتًا طويلًا. حاول مرة أخرى.",
  },
  Hindi: {
    step1: "फ़ोटो जोड़ें", step2: "आपने क्या देखा?", weather: "स्थानीय मौसम इस्तेमाल करें",
    diagnose: "जाँच करें", needPhoto: "शुरू करने के लिए कम से कम एक फ़ोटो जोड़ें।",
    retry: "फिर कोशिश करें", back: "फ़ोटो पर वापस जाएँ",
    history: "पिछली जाँचें", historyEmpty: "अभी कोई जाँच सहेजी नहीं गई।",
    clear: "इतिहास मिटाएँ", clearConfirm: "इस डिवाइस पर सहेजी सभी जाँचें मिटाएँ?",
    cancel: "रद्द करें", delete: "मिटाएँ", close: "बंद करें",
    listen: "सुनें", confidence: "भरोसा", notSure: "अभी पक्का नहीं",
    err_offline: "आप ऑफ़लाइन हैं। कनेक्ट होकर फिर कोशिश करें।",
    err_busy: "AI सेवा व्यस्त है। थोड़ी देर में फिर कोशिश करें।",
    err_timeout: "जाँच में बहुत समय लगा। फिर कोशिश करें।",
  },
  Swahili: {
    step1: "Ongeza picha", step2: "Umeona nini?", weather: "Tumia hali ya hewa ya hapa",
    diagnose: "Chunguza", needPhoto: "Ongeza angalau picha moja kuanza.",
    retry: "Jaribu tena", back: "Rudi kwenye picha",
    history: "Uchunguzi wa awali", historyEmpty: "Hakuna uchunguzi uliohifadhiwa.",
    clear: "Futa historia", clearConfirm: "Futa uchunguzi wote uliohifadhiwa kwenye kifaa hiki?",
    cancel: "Ghairi", delete: "Futa", close: "Funga",
    listen: "Sikiliza", confidence: "Uhakika", notSure: "Bado hakuna uhakika",
    err_offline: "Hauko mtandaoni. Unganisha tena kisha ujaribu.",
    err_busy: "Huduma ya AI ina shughuli. Jaribu tena baada ya muda mfupi.",
    err_timeout: "Uchunguzi ulichukua muda mrefu. Jaribu tena.",
  },
  Chinese: {
    step1: "添加照片", step2: "你注意到了什么？", weather: "使用当地天气",
    diagnose: "诊断", needPhoto: "请至少添加一张照片。",
    retry: "重试", back: "返回照片",
    history: "以前的检查", historyEmpty: "尚无保存的检查。",
    clear: "清除记录", clearConfirm: "删除此设备上保存的所有检查？",
    cancel: "取消", delete: "删除", close: "关闭",
    listen: "朗读", confidence: "可信度", notSure: "还不确定",
    err_offline: "你处于离线状态。请连接网络后重试。",
    err_busy: "AI 服务繁忙。请稍后再试。",
    err_timeout: "分析时间过长。请重试。",
  },
};

export function language(name) {
  return LANGUAGES.find((l) => l.api === name) || LANGUAGES[0];
}

// Missing keys fall back to English so a partial translation never shows "undefined".
export function t(langName, key) {
  const table = STRINGS[langName] || {};
  return table[key] || STRINGS.English[key] || key;
}

// Applies every data-i18n / data-i18n-ph / data-i18n-label in the document.
export function applyStaticText(langName) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = t(langName, el.dataset.i18n);
    if (el.textContent !== value) el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(langName, el.dataset.i18nPh);
  });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    el.setAttribute("aria-label", t(langName, el.dataset.i18nLabel));
  });
}
