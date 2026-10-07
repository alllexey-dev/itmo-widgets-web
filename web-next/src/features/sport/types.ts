import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type AutoEntry = Schemas['SportAutoSignEntry'];
export type FreeEntry = Schemas['SportFreeSignEntry'];
/** One of the user's queue entries; `type` tells the queue (`auto` forecast, `free` place). */
export type QueueEntry = AutoEntry | FreeEntry;
export type SportLesson = Schemas['SportLessonDto'];
export type AutoSignLimits = Schemas['SportAutoSignLimits'];
