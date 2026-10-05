const r = (module, group, activity, day, time, venue) => ({ module, semester: 'S2', group, language: 'E', activity, period: activity + '1', day, time, venue, campus: 'HATFIELD' });
/**
 * Small fictional timetable used by the landing-page demo. Same record shape
 * that pdfTableParser.js produces, so it runs through the real solver.
 */
export const DEMO_MODULES = ['COS 110', 'WTW 134', 'STC 122', 'ALL 121'];

export const DEMO_RECORDS = [
  // COS 110: 2 lecture groups, 2 practical groups, 2 tutorial groups
  r('COS 110','G01','L','Monday','07:30 - 08:20','IT 4-1'), r('COS 110','G01','L','Thursday','07:30 - 08:20','IT 4-1'),
  r('COS 110','G02','L','Tuesday','13:30 - 14:20','IT 4-1'), r('COS 110','G02','L','Friday','13:30 - 14:20','IT 4-1'),
  r('COS 110','P01','P','Wednesday','08:30 - 10:20','Informatorium Lab'), r('COS 110','P02','P','Thursday','14:30 - 16:20','Informatorium Lab'),
  r('COS 110','T01','T','Tuesday','09:30 - 10:20','IT 4-5'), r('COS 110','T02','T','Friday','15:30 - 16:20','IT 4-5'),
  // WTW 134
  r('WTW 134','G01','L','Monday','08:30 - 09:20','Roos Hall'), r('WTW 134','G01','L','Wednesday','08:30 - 09:20','Roos Hall'),
  r('WTW 134','G02','L','Monday','14:30 - 15:20','Roos Hall'), r('WTW 134','G02','L','Wednesday','14:30 - 15:20','Roos Hall'),
  r('WTW 134','T01','T','Thursday','09:30 - 10:20','Centenary 3'), r('WTW 134','T02','T','Thursday','15:30 - 16:20','Centenary 3'),
  // STC 122
  r('STC 122','G01','L','Tuesday','10:30 - 11:20','Thuto 1-1'), r('STC 122','G01','L','Friday','10:30 - 11:20','Thuto 1-1'),
  r('STC 122','G02','L','Tuesday','15:30 - 16:20','Thuto 1-2'), r('STC 122','G02','L','Friday','14:30 - 15:20','Thuto 1-2'),
  r('STC 122','P01','P','Monday','10:30 - 12:20','IT Bronze Lab'), r('STC 122','P02','P','Monday','15:30 - 17:20','IT Bronze Lab'),
  r('STC 122','G03','L','Monday','13:30 - 14:20','Thuto 1-2'), r('STC 122','G03','L','Thursday','13:30 - 14:20','Thuto 1-2'),
  // ALL 121
  r('ALL 121','G01','L','Wednesday','10:30 - 11:20','HB 4-12'), r('ALL 121','G01','L','Thursday','11:30 - 12:20','HB 4-12'),
  r('ALL 121','G02','L','Wednesday','15:30 - 16:20','HB 4-12'), r('ALL 121','G02','L','Thursday','16:30 - 17:20','HB 4-12'),
];
