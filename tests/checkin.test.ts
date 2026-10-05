import {describe,expect,it} from 'vitest';
import {checkinStreak,kstDateKey} from '../src/domain/checkin';

describe('출근 도장',()=>{
  it('한국 날짜로 하루를 나눈다(UTC 23:40 = 한국 다음날 08:40)',()=>{
    expect(kstDateKey(new Date('2026-10-04T23:40:00Z'))).toBe('2026-10-5');
    expect(kstDateKey(new Date('2026-10-05T14:59:00Z'))).toBe('2026-10-5');
    expect(kstDateKey(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-6');
  });
  it('연속 출근은 주말을 건너뛰고, 오늘 아직 안 찍었으면 어제까지 센다',()=>{
    // 2026-10-02(금), 10-05(월), 10-06(화) → 화요일 기준 3일 연속(주말 건너뜀)
    expect(checkinStreak(['2026-10-2','2026-10-5','2026-10-6'],'2026-10-6')).toBe(3);
    expect(checkinStreak(['2026-10-2','2026-10-5'],'2026-10-6')).toBe(2);
    expect(checkinStreak(['2026-10-1','2026-10-5'],'2026-10-6')).toBe(1); // 금요일이 빠져 끊김
    expect(checkinStreak([],'2026-10-6')).toBe(0);
  });
});
