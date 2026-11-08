// Descriptive availability only; never extrapolate absent draw records.
export function describeHistoryAvailability(validDraws, requestedDraws, sourceFailed = false) {
  if (!Number.isInteger(validDraws) || validDraws < 0 ||
      ![10, 20, 30].includes(requestedDraws)) throw new TypeError('Invalid history window');
  if (sourceFailed) return {
    status: 'โหลดไม่สำเร็จ',
    message: 'โหลดข้อมูลย้อนหลังไม่สำเร็จ ไม่สามารถยืนยันความครบถ้วนของช่วงข้อมูลได้',
  };
  if (validDraws === 0) return {
    status: 'ยังไม่มีข้อมูล',
    message: 'ยังไม่พบผลย้อนหลังที่ตรวจสอบและจับคู่ได้ ไม่แสดงสถิติแทนข้อมูลที่ไม่มี',
  };
  if (validDraws < requestedDraws) return {
    status: 'ข้อมูลบางส่วน',
    message: `มีข้อมูลที่ตรวจสอบได้ ${validDraws} จาก ${requestedDraws} งวดที่เลือก สถิติคำนวณจากข้อมูลที่มีจริงเท่านั้น`,
  };
  return {
    status: 'มีข้อมูลย้อนหลัง',
    message: `มีข้อมูลสำหรับช่วง ${requestedDraws} งวดที่เลือก สถิติคำนวณจากงวดที่ตรวจสอบได้`,
  };
}
