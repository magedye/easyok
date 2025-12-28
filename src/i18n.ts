import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'

void i18n
   .use(LanguageDetector)
   .use(initReactI18next)
   .init({
     resources: {
       en: { translation: en },
       ar: { translation: ar },
     },
     fallbackLng: 'en',
     lng: 'en',
     supportedLngs: ['ar', 'en'],
     interpolation: {
       escapeValue: false,
     },
     detection: {
       order: ['querystring', 'localStorage', 'navigator'],
       lookupQuerystring: 'lang',
       caches: ['localStorage'],
     },
   })

export default i18n
