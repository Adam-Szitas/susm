import type { SvgIconDefinition, SvgIconElement } from './icon.model';

function stroke24(elements: SvgIconElement[], overrides: Partial<SvgIconDefinition> = {}): SvgIconDefinition {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    elements,
    ...overrides,
  };
}

export const archiveIcon = stroke24([
  { tag: 'rect', x: 2, y: 3, width: 20, height: 5, rx: 1 },
  { tag: 'path', d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' },
  { tag: 'path', d: 'M10 12h4' },
]);

export const plusIcon = stroke24([{ tag: 'path', d: 'M12 5v14M5 12h14' }]);

export const editIcon = stroke24([
  { tag: 'path', d: 'M12 20h9' },
  { tag: 'path', d: 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z' },
]);

export const fileTextIcon = stroke24([
  { tag: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
  { tag: 'polyline', points: '14 2 14 8 20 8' },
  { tag: 'line', x1: 16, y1: 13, x2: 8, y2: 13 },
  { tag: 'line', x1: 16, y1: 17, x2: 8, y2: 17 },
]);

export const mapPinIcon = stroke24([
  { tag: 'path', d: 'M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z' },
  { tag: 'circle', cx: 12, cy: 10, r: 2.5 },
]);

export const listIcon = stroke24([
  { tag: 'path', d: 'M9 6h11M9 12h11M9 18h11' },
  { tag: 'path', d: 'M4 6h.01M4 12h.01M4 18h.01' },
]);

export const filterIcon = stroke24([{ tag: 'path', d: 'M4 5h16l-6 7v5l-4 2v-7L4 5z' }]);

export const filterOffIcon = stroke24([
  { tag: 'path', d: 'M4 5h16l-6 7v5l-4 2v-7L4 5z' },
  { tag: 'line', x1: 4, y1: 4, x2: 20, y2: 20 },
]);

export const checkIcon = stroke24(
  [{ tag: 'polyline', points: '20 6 9 17 4 12' }],
  { strokeWidth: 2 },
);

export const arrowsUpDownIcon = stroke24([
  { tag: 'path', d: 'M8 9l4-4 4 4' },
  { tag: 'path', d: 'M8 15l4 4 4-4' },
  { tag: 'line', x1: 12, y1: 5, x2: 12, y2: 19 },
]);

export const fileUploadIcon = stroke24([
  { tag: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
  { tag: 'polyline', points: '14 2 14 8 20 8' },
  { tag: 'path', d: 'M12 12v6' },
  { tag: 'path', d: 'M9 15l3-3 3 3' },
]);

export const cloudUploadIcon: SvgIconDefinition = {
  viewBox: '0 0 640 640',
  fill: 'currentColor',
  elements: [
    {
      tag: 'path',
      d: 'M352 173.3L352 384C352 401.7 337.7 416 320 416C302.3 416 288 401.7 288 384L288 173.3L246.6 214.7C234.1 227.2 213.8 227.2 201.3 214.7C188.8 202.2 188.8 181.9 201.3 169.4L297.3 73.4C309.8 60.9 330.1 60.9 342.6 73.4L438.6 169.4C451.1 181.9 451.1 202.2 438.6 214.7C426.1 227.2 405.8 227.2 393.3 214.7L352 173.3zM320 464C364.2 464 400 428.2 400 384L480 384C515.3 384 544 412.7 544 448L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 448C96 412.7 124.7 384 160 384L240 384C240 428.2 275.8 464 320 464zM464 488C477.3 488 488 477.3 488 464C488 450.7 477.3 440 464 440C450.7 440 440 450.7 440 464C440 477.3 450.7 488 464 488z',
    },
  ],
};

export const pinFilledIcon: SvgIconDefinition = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  elements: [
    {
      tag: 'path',
      d: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
    },
  ],
};

export const hamburgerIcon: SvgIconDefinition = {
  viewBox: '0 0 100 80',
  fill: 'white',
  elements: [{ tag: 'path', d: 'M0 0h100v20H0zM0 30h100v20H0zM0 60h100v20H0z' }],
};

export const closeFilledIcon: SvgIconDefinition = {
  viewBox: '0 0 24 24',
  fill: 'white',
  elements: [
    {
      tag: 'path',
      fillRule: 'evenodd',
      clipRule: 'evenodd',
      d: 'M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 1 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z',
    },
  ],
};

export const closeIcon = stroke24([
  { tag: 'line', x1: 18, y1: 6, x2: 6, y2: 18 },
  { tag: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
]);

export const trashIcon = stroke24(
  [
    { tag: 'path', d: 'M3 6h18' },
    { tag: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { tag: 'path', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
    { tag: 'line', x1: 10, x2: 10, y1: 11, y2: 17 },
    { tag: 'line', x1: 14, x2: 14, y1: 11, y2: 17 },
  ],
  { strokeLinecap: 'round' },
);

export const trashBinIcon = stroke24(
  [
    { tag: 'path', d: 'M3 6h18' },
    { tag: 'path', d: 'M8 6V4h8v2' },
    { tag: 'path', d: 'M19 6l-1 14H6L5 6' },
    { tag: 'path', d: 'M10 11v6' },
    { tag: 'path', d: 'M14 11v6' },
  ],
  { strokeLinecap: 'round' },
);

export const briefcaseIcon = stroke24(
  [
    { tag: 'path', d: 'M4 7h16v12H4z' },
    { tag: 'path', d: 'M4 7l2-3h12l2 3' },
  ],
  { strokeWidth: 1.75 },
);

export const cubeIcon = stroke24(
  [
    { tag: 'path', d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z' },
    { tag: 'path', d: 'M12 12l8-4.5M12 12v9M12 12L4 7.5' },
  ],
  { strokeWidth: 1.75 },
);

export const fileSimpleIcon = stroke24(
  [
    { tag: 'path', d: 'M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z' },
    { tag: 'path', d: 'M14 2v6h6' },
  ],
  { strokeWidth: 1.75 },
);

export const usersIcon = stroke24(
  [
    { tag: 'circle', cx: 9, cy: 8, r: 3 },
    { tag: 'circle', cx: 17, cy: 9, r: 2.5 },
    { tag: 'path', d: 'M3 19c0-2.2 2.7-4 6-4s6 1.8 6 4M14 19c0-1.6 1.8-3 4-3' },
  ],
  { strokeWidth: 1.75 },
);

export const gripHorizontalIcon = stroke24([
  { tag: 'rect', x: 3, y: 4, width: 18, height: 4, rx: 1 },
  { tag: 'rect', x: 3, y: 10, width: 18, height: 4, rx: 1 },
  { tag: 'rect', x: 3, y: 16, width: 18, height: 4, rx: 1 },
]);

export const uploadArrowIcon = stroke24([
  { tag: 'path', d: 'M12 3v12' },
  { tag: 'path', d: 'M7 8l5-5 5 5' },
  { tag: 'path', d: 'M4 21h16' },
]);

export const menuLinesIcon = stroke24(
  [
    { tag: 'path', d: 'M4 6h16' },
    { tag: 'path', d: 'M4 12h16' },
    { tag: 'path', d: 'M4 18h16' },
  ],
  { strokeLinecap: 'round' },
);

export const zoomInIcon = stroke24([
  { tag: 'circle', cx: 11, cy: 11, r: 8 },
  { tag: 'path', d: 'm21 21-4.35-4.35' },
  { tag: 'path', d: 'M11 8v6M8 11h6' },
]);

export const chevronRightIcon = stroke24([
  { tag: 'path', d: 'M5 12h14' },
  { tag: 'path', d: 'M13 6l6 6-6 6' },
]);

export const downloadIcon = stroke24([
  { tag: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
  { tag: 'polyline', points: '7 10 12 15 17 10' },
  { tag: 'line', x1: 12, x2: 12, y1: 15, y2: 3 },
]);

export const uploadCombinedIcon = stroke24(
  [{ tag: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' }],
  { strokeLinecap: 'round' },
);

export const eyeOffIcon = stroke24([
  { tag: 'path', d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' },
  { tag: 'path', d: 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' },
  { tag: 'path', d: 'M1 1l22 22' },
  { tag: 'path', d: 'M14.12 14.12a3 3 0 1 1-4.24-4.24' },
]);

export const eyeIcon = stroke24([
  { tag: 'path', d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' },
  { tag: 'circle', cx: 12, cy: 12, r: 3 },
]);

export const chevronLeftIcon = stroke24(
  [{ tag: 'path', d: 'M19 12H5M11 18l-6-6 6-6' }],
  { strokeWidth: 2.5 },
);

export const loaderIcon = stroke24([
  { tag: 'path', d: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83' },
]);

export const refreshIcon = stroke24(
  [
    { tag: 'path', d: 'M21 12a9 9 0 1 1-2.64-6.36' },
    { tag: 'path', d: 'M21 3v6h-6' },
  ],
  { strokeWidth: 2.5 },
);

export const fileTextDetailedIcon = stroke24(
  [
    { tag: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
    { tag: 'path', d: 'M14 2v6h6M16 13H8M16 17H8M10 9H8' },
  ],
  { strokeWidth: 2.5 },
);

export const clipboardCheckIcon = stroke24(
  [
    { tag: 'path', d: 'M9 11l3 3L22 4' },
    { tag: 'path', d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  ],
  { strokeWidth: 2.5 },
);

export const squarePlusIcon = stroke24(
  [
    { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { tag: 'path', d: 'M9 12h6' },
    { tag: 'path', d: 'M12 9v6' },
  ],
  { strokeWidth: 2.5 },
);

export const clipboardIcon = stroke24([
  { tag: 'path', d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
]);

export const flagIcon = stroke24([
  { tag: 'path', d: 'M4 22V4' },
  { tag: 'path', d: 'M4 4h11l-1.5 3L15 10H4' },
]);

export const clipboardWithCheckIcon = stroke24([
  { tag: 'path', d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2' },
  { tag: 'rect', x: 9, y: 3, width: 6, height: 4, rx: 1 },
  { tag: 'path', d: 'M9 14l2 2 4-4' },
]);

export const susmLogoIcon: SvgIconDefinition = {
  viewBox: '0 0 512 305.98',
  fill: '#fff',
  fillRule: 'evenodd',
  clipRule: 'evenodd',
  elements: [
    {
      tag: 'path',
      d: 'M153.12 122.45h21.82v22.3h-21.82v-22.3zm-15.88 90.06h83.32v79.05h89.77v-136.6c0-.38.04-.74.11-1.1L179.48 58.02 45.77 153.91c.13.47.2.97.2 1.48v136.17h91.27v-79.05zm187.51 87.74c0 3.16-2.56 5.73-5.74 5.73H37.28c-3.17 0-5.74-2.57-5.74-5.73V161.36c-29.41 11.32-40.3-24.88-23.87-37.82L174.57 1.51c2.03-1.86 5.16-2.05 7.4-.3l167.26 121.77c-.01.02.62.56.68.63 19.8 21.32-1.07 49.48-25.16 38.11v138.53zm20.67-87.74h23.08v81.11h104.1V162.93c0-.43.06-.86.16-1.26l-114.6-82.19-16.82 12.31-34.56-25.16 49.24-35.85a4.904 4.904 0 0 1 6.34.26l89.84 65.68V65.21h39.1v60.1l14.13 10.33c14.03 10.9 4.85 42.16-20.46 32.41v133.02c0 2.71-2.21 4.91-4.92 4.91H344.79l.63-5.73v-87.74zm-140.75-60.33h-21.81v22.3h21.81v-22.3zm-51.55 0h21.82v22.3h-21.82v-22.3zm51.55-29.73h-21.81v22.3h21.81v-22.3z',
    },
  ],
};

/** Registry of all icons — import from `@icons`. */
export const icons = {
  archive: archiveIcon,
  plus: plusIcon,
  edit: editIcon,
  fileText: fileTextIcon,
  mapPin: mapPinIcon,
  list: listIcon,
  filter: filterIcon,
  filterOff: filterOffIcon,
  check: checkIcon,
  arrowsUpDown: arrowsUpDownIcon,
  fileUpload: fileUploadIcon,
  cloudUpload: cloudUploadIcon,
  pinFilled: pinFilledIcon,
  hamburger: hamburgerIcon,
  closeFilled: closeFilledIcon,
  close: closeIcon,
  trash: trashIcon,
  trashBin: trashBinIcon,
  briefcase: briefcaseIcon,
  cube: cubeIcon,
  fileSimple: fileSimpleIcon,
  users: usersIcon,
  gripHorizontal: gripHorizontalIcon,
  uploadArrow: uploadArrowIcon,
  menuLines: menuLinesIcon,
  zoomIn: zoomInIcon,
  chevronRight: chevronRightIcon,
  download: downloadIcon,
  uploadCombined: uploadCombinedIcon,
  eyeOff: eyeOffIcon,
  eye: eyeIcon,
  chevronLeft: chevronLeftIcon,
  loader: loaderIcon,
  refresh: refreshIcon,
  fileTextDetailed: fileTextDetailedIcon,
  clipboardCheck: clipboardCheckIcon,
  squarePlus: squarePlusIcon,
  clipboard: clipboardIcon,
  flag: flagIcon,
  clipboardWithCheck: clipboardWithCheckIcon,
  susmLogo: susmLogoIcon,
} as const;
