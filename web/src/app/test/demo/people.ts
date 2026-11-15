import type { components } from '../../api/schema';

type GroupData = components['schemas']['GroupData'];

/**
 * The invented population of the demo: every area takes its people from here, so the same ISU is the
 * same person everywhere. A friend of the visitor, the author of a moderation case and a row of the
 * users list are one student, and a link from one area opens that student in another.
 */
export interface DemoPerson {
  isu: number;
  name: string;
  group: GroupData;
}

/** How many users the demo has: the users list holds this many, and the dashboard counts the list. */
export const POPULATION = 1480;

const FACULTIES: Record<string, string> = {
  P: 'ФПИиКТ',
  M: 'ФИТиП',
  K: 'ФИКТ',
  R: 'ФСУиР',
  N: 'ФБИТ',
  T: 'ФТМИ',
};

/** A group by its name: the first letter is the faculty, the third character is the course. */
export function groupOf(name: string): GroupData {
  return {
    name,
    course: Number(name[2] ?? 1),
    facultyShortName: FACULTIES[name[0] ?? ''] ?? 'ФПИиКТ',
  };
}

const person = (isu: number, name: string, group: string): DemoPerson => ({
  isu,
  name,
  group: groupOf(group),
});

/** The signed-in visitor (`userOf` in `../server`) and the rest of the staff. */
export const STAFF = {
  anna: person(400001, 'Анна Смирнова', 'P3212'),
  gleb: person(400002, 'Глеб Орлов', 'M3205'),
  ruslan: person(400003, 'Руслан Каримов', 'R3338'),
};

/** The people behind the moderation cases and restrictions; the first three are the visitor's friends. */
export const AUTHORS: readonly DemoPerson[] = [
  person(412004, 'Мария Белова', 'P3212'),
  person(412118, 'Тимур Ахметов', 'P3213'),
  person(409871, 'Софья Ким', 'M3205'),
  person(415230, 'Глеб Воронцов', 'P3210'),
  person(410562, 'Алина Сафина', 'K3241'),
  person(413377, 'Даниил Орехов', 'P3215'),
  person(408915, 'Вероника Лебедева-Заречная', 'R3237'),
  person(416042, 'Артём Гусев', 'P3217'),
];

/** An author by the place in the list, wrapping around. */
export function authorAt(index: number): DemoPerson {
  return AUTHORS[index % AUTHORS.length] as DemoPerson;
}

/** The other people the visitor meets in Друзья: friends, both kinds of requests and strangers. */
export const STUDENTS = {
  darya: person(412305, 'Дарья Волкова', 'P3212'),
  artem: person(412306, 'Артём Соколов', 'R3237'),
  polina: person(412307, 'Полина Жукова', 'P3215'),
  nikita: person(412308, 'Никита Воронин', 'T3310'),
  alina: person(412309, 'Алина Гусева', 'M3205'),
  roman: person(412310, 'Роман Тихонов', 'P3212'),
  // The app of this one has not uploaded a name yet.
  nameless: person(412311, '', 'K3241'),
  eva: person(412321, 'Ева Морозова', 'P3213'),
  lev: person(412322, 'Лев Захаров', 'M3207'),
  konstantin: person(412323, 'Константин Константинопольский-Задунайский', 'R3237'),
  vera: person(412331, 'Вера Данилова', 'P3215'),
  mark: person(412332, 'Марк Ефимов', 'T3310'),
  oleg: person(412341, 'Олег Сидоров', 'P3212'),
  yana: person(412342, 'Яна Крылова', 'M3205'),
};

/** Everyone with a part in some area, the visitor first. */
export const NAMED: readonly DemoPerson[] = [
  ...Object.values(STAFF),
  ...AUTHORS,
  ...Object.values(STUDENTS),
];

const BY_ISU = new Map(NAMED.map((who) => [who.isu, who]));

/** The person with this ISU, when they have a part in some area. */
export function personOf(isu: number): DemoPerson | undefined {
  return BY_ISU.get(isu);
}
