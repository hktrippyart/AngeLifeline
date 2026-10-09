export interface EmsNumber {
  tel: string;
  zh: string;
  en: string;
}

export interface RegionInfo {
  label: { zh: string; en: string };
  numbers: EmsNumber[];
}
