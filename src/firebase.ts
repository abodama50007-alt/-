import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AppSettings,
  BookmarkItem,
  DailyStreakState,
  GroupKhatmahMemberRecord,
  GroupKhatmahRecord,
  GroupKhatmahStatus,
  HifzQuizAchievementRecord,
  KhatmahState,
  LastReadPosition,
  PersonalKhatmahRecord,
  ReflectionNote,
} from './types/quran';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email || 'قارئ القرآن').slice(
    0,
    120
  );
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.email) payload.email = user.email.slice(0, 200);
      if (user.photoURL) payload.photoURL = user.photoURL.slice(0, 500);
      await setDoc(ref, payload);
    } else {
      const updates: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (user.email) updates.email = user.email.slice(0, 200);
      if (user.photoURL) updates.photoURL = user.photoURL.slice(0, 500);
      await updateDoc(ref, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export interface CloudSyncPayload {
  totalTasbeehCount: number;
  khatmah: KhatmahState;
  lastRead: LastReadPosition;
  settings: AppSettings;
  adhanId: string;
}

export interface LoadedCloudState {
  syncState: Partial<{
    totalTasbeehCount: number;
    khatmahCurrentPage: number;
    khatmahTargetDays: number;
    khatmahCompletedJuz: number[];
    lastReadSurah: number;
    lastReadSurahName: string;
    lastReadAyah: number;
    lastReadPage: number;
    lastReadJuz: number;
    reciterId: string;
    tafsirEdition: AppSettings['tafsirEdition'];
    readingMode: AppSettings['readingMode'];
    fontSize: number;
    themeMode: AppSettings['themeMode'];
    adhanId: string;
  }> | null;
  bookmarks: BookmarkItem[];
  notes: ReflectionNote[];
}

export async function loadUserCloudData(uid: string): Promise<LoadedCloudState> {
  const syncPath = `users/${uid}/sync/state`;
  let syncState: LoadedCloudState['syncState'] = null;
  try {
    const syncSnap = await getDoc(doc(db, 'users', uid, 'sync', 'state'));
    if (syncSnap.exists()) {
      syncState = syncSnap.data() as LoadedCloudState['syncState'];
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, syncPath);
  }

  let bookmarks: BookmarkItem[] = [];
  const bookmarksPath = `users/${uid}/bookmarks`;
  try {
    const bookmarksQuery = query(
      collection(db, 'users', uid, 'bookmarks'),
      where('uid', '==', uid)
    );
    const bSnap = await getDocs(bookmarksQuery);
    bookmarks = bSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        surahNumber: Number(data.surahNumber),
        surahName: String(data.surahName),
        ayahNumberInSurah: Number(data.ayahNumberInSurah),
        globalAyahNumber: Number(data.globalAyahNumber),
        ayahPreview: String(data.ayahPreview ?? ''),
        page: Number(data.page),
        createdAt:
          typeof data.createdAt?.toMillis === 'function'
            ? data.createdAt.toMillis()
            : Date.now(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, bookmarksPath);
  }

  let notes: ReflectionNote[] = [];
  const notesPath = `users/${uid}/notes`;
  try {
    const notesQuery = query(
      collection(db, 'users', uid, 'notes'),
      where('uid', '==', uid)
    );
    const nSnap = await getDocs(notesQuery);
    notes = nSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        surahNumber: Number(data.surahNumber),
        surahName: String(data.surahName),
        ayahNumberInSurah: Number(data.ayahNumberInSurah),
        note: String(data.note ?? ''),
        updatedAt:
          typeof data.updatedAt?.toMillis === 'function'
            ? data.updatedAt.toMillis()
            : Date.now(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, notesPath);
  }

  return { syncState, bookmarks, notes };
}

export async function saveSyncState(
  uid: string,
  payload: CloudSyncPayload
): Promise<void> {
  const path = `users/${uid}/sync/state`;
  const ref = doc(db, 'users', uid, 'sync', 'state');

  const clampedPage = Math.max(1, Math.min(604, Math.round(payload.khatmah.currentPage || 1)));
  const clampedDays = Math.max(1, Math.min(365, Math.round(payload.khatmah.targetDays || 30)));
  const clampedFont = Math.max(16, Math.min(56, Math.round(payload.settings.fontSize || 28)));
  const safeCompletedJuz = (payload.khatmah.completedJuz || [])
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
    .slice(0, 30);

  const safeTafsir =
    payload.settings.tafsirEdition === 'ar.jalalayn' ||
    payload.settings.tafsirEdition === 'en.sahih'
      ? payload.settings.tafsirEdition
      : 'ar.muyassar';
  const safeReadingMode =
    payload.settings.readingMode === 'page' ? 'page' : 'verses';
  const safeThemeMode =
    payload.settings.themeMode === 'light' || payload.settings.themeMode === 'dark'
      ? payload.settings.themeMode
      : 'auto';

  const mutableData = {
    totalTasbeehCount: Math.max(
      0,
      Math.min(10_000_000, Math.round(payload.totalTasbeehCount || 0))
    ),
    khatmahCurrentPage: clampedPage,
    khatmahTargetDays: clampedDays,
    khatmahCompletedJuz: safeCompletedJuz,
    lastReadSurah: Math.max(
      1,
      Math.min(114, Math.round(payload.lastRead.surahNumber || 1))
    ),
    lastReadSurahName: (payload.lastRead.surahName || 'سورة الفاتحة').slice(0, 120),
    lastReadAyah: Math.max(
      1,
      Math.min(286, Math.round(payload.lastRead.ayahNumberInSurah || 1))
    ),
    lastReadPage: Math.max(
      1,
      Math.min(604, Math.round(payload.lastRead.page || 1))
    ),
    lastReadJuz: Math.max(
      1,
      Math.min(30, Math.round(payload.lastRead.juz || 1))
    ),
    reciterId: (payload.settings.reciterId || 'ar.alafasy').slice(0, 120),
    tafsirEdition: safeTafsir,
    readingMode: safeReadingMode,
    fontSize: clampedFont,
    themeMode: safeThemeMode,
    adhanId: (payload.adhanId || 'makkah').slice(0, 64),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, ...mutableData });
    } else {
      await updateDoc(ref, mutableData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertCloudBookmark(
  uid: string,
  item: BookmarkItem
): Promise<void> {
  const path = `users/${uid}/bookmarks/${item.id}`;
  const ref = doc(db, 'users', uid, 'bookmarks', item.id);
  const safePage = Math.max(1, Math.min(604, Math.round(item.page || 1)));
  const safePreview = (item.ayahPreview || '').slice(0, 1200);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        id: item.id.slice(0, 64),
        surahNumber: Math.max(1, Math.min(114, Math.round(item.surahNumber || 1))),
        surahName: (item.surahName || 'سورة').slice(0, 120),
        ayahNumberInSurah: Math.max(1, Math.min(286, Math.round(item.ayahNumberInSurah || 1))),
        globalAyahNumber: Math.max(1, Math.min(6236, Math.round(item.globalAyahNumber || 1))),
        ayahPreview: safePreview,
        page: safePage,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ayahPreview: safePreview,
        page: safePage,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudBookmark(
  uid: string,
  bookmarkId: string
): Promise<void> {
  const path = `users/${uid}/bookmarks/${bookmarkId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', bookmarkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCloudNote(
  uid: string,
  note: ReflectionNote
): Promise<void> {
  const path = `users/${uid}/notes/${note.id}`;
  const ref = doc(db, 'users', uid, 'notes', note.id);
  const trimmed = note.note.trim().slice(0, 2000);
  if (!trimmed) return;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        id: note.id.slice(0, 64),
        surahNumber: Math.max(1, Math.min(114, Math.round(note.surahNumber || 1))),
        surahName: (note.surahName || 'سورة').slice(0, 120),
        ayahNumberInSurah: Math.max(1, Math.min(286, Math.round(note.ayahNumberInSurah || 1))),
        note: trimmed,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        note: trimmed,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudNote(
  uid: string,
  noteId: string
): Promise<void> {
  const path = `users/${uid}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const ADMIN_EMAIL = 'abodama50007@gmail.com';

export function isAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

export interface RegisteredUserRecord {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export async function fetchRegisteredUsers(): Promise<RegisteredUserRecord[]> {
  const path = 'users';
  try {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('updatedAt', 'desc'),
      limit(250)
    );
    const snap = await getDocs(usersQuery);
    return snap.docs.map((d) => {
      const data = d.data();
      const createdAtMs =
        typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : 0;
      const updatedAtMs =
        typeof data.updatedAt?.toMillis === 'function'
          ? data.updatedAt.toMillis()
          : createdAtMs;
      return {
        uid: String(data.uid || d.id),
        displayName: String(data.displayName || 'مستخدم'),
        email: typeof data.email === 'string' ? data.email : null,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
        createdAtMs,
        updatedAtMs,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export type CompanionRoomStatus = 'waiting' | 'active' | 'finished';
export type CompanionRoomMode = 'hifz' | 'sunnah' | 'mixed';
export type CompanionMessageKind = 'chat' | 'nudge' | 'ayah_share';

export interface CompanionRoomRecord {
  roomCode: string;
  title: string;
  hostUid: string;
  hostName: string;
  guestUid: string;
  guestName: string;
  status: CompanionRoomStatus;
  mode: CompanionRoomMode;
  questionIds: string[];
  hostScore: number;
  guestScore: number;
  hostAnsweredCount: number;
  guestAnsweredCount: number;
  sharedSurahNumber: number;
  sharedAyahNumber: number;
  currentQuestionIndex: number;
  hostAnswerForCurrent: number;
  guestAnswerForCurrent: number;
  hostReady: boolean;
  guestReady: boolean;
  questionStartedAtMs: number;
  liveEventText: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CompanionMessageRecord {
  id: string;
  uid: string;
  senderName: string;
  kind: CompanionMessageKind;
  text: string;
  surahNumber: number;
  ayahNumber: number;
  createdAtMs: number;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code +=
      ROOM_CODE_ALPHABET[
        Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      ];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function mapRoomDoc(
  docId: string,
  data: Record<string, unknown>
): CompanionRoomRecord {
  const createdAtVal = data.createdAt as { toMillis?: () => number } | undefined;
  const updatedAtVal = data.updatedAt as { toMillis?: () => number } | undefined;
  const createdAtMs =
    typeof createdAtVal?.toMillis === 'function' ? createdAtVal.toMillis() : 0;
  const updatedAtMs =
    typeof updatedAtVal?.toMillis === 'function'
      ? updatedAtVal.toMillis()
      : createdAtMs;

  return {
    roomCode: String(data.roomCode || docId),
    title: String(data.title || 'مجلس حفظ ومنافسة'),
    hostUid: String(data.hostUid || ''),
    hostName: String(data.hostName || 'المضيف'),
    guestUid: String(data.guestUid || ''),
    guestName: String(data.guestName || ''),
    status:
      data.status === 'active' || data.status === 'finished'
        ? data.status
        : 'waiting',
    mode:
      data.mode === 'hifz' || data.mode === 'sunnah' || data.mode === 'mixed'
        ? data.mode
        : 'mixed',
    questionIds: Array.isArray(data.questionIds)
      ? data.questionIds.filter((q): q is string => typeof q === 'string')
      : [],
    hostScore: Number(data.hostScore || 0),
    guestScore: Number(data.guestScore || 0),
    hostAnsweredCount: Number(data.hostAnsweredCount || 0),
    guestAnsweredCount: Number(data.guestAnsweredCount || 0),
    sharedSurahNumber: Number(data.sharedSurahNumber || 1),
    sharedAyahNumber: Number(data.sharedAyahNumber || 1),
    currentQuestionIndex: Number(data.currentQuestionIndex || 0),
    hostAnswerForCurrent:
      typeof data.hostAnswerForCurrent === 'number'
        ? data.hostAnswerForCurrent
        : -1,
    guestAnswerForCurrent:
      typeof data.guestAnswerForCurrent === 'number'
        ? data.guestAnswerForCurrent
        : -1,
    hostReady: Boolean(data.hostReady ?? true),
    guestReady: Boolean(data.guestReady ?? false),
    questionStartedAtMs: Number(data.questionStartedAtMs || 0),
    liveEventText: typeof data.liveEventText === 'string' ? data.liveEventText : '',
    createdAtMs,
    updatedAtMs,
  };
}

export async function createCompanionRoom(params: {
  user: User;
  title: string;
  mode: CompanionRoomMode;
  questionIds: string[];
  sharedSurahNumber?: number;
  sharedAyahNumber?: number;
}): Promise<CompanionRoomRecord> {
  const uid = params.user.uid;
  const displayName = (params.user.displayName || 'قارئ القرآن')
    .trim()
    .slice(0, 80);
  const safeIds = params.questionIds.slice(0, 12);
  if (safeIds.length === 0) {
    throw new Error('يجب اختيار سؤال واحد على الأقل للغرفة');
  }

  const roomCode = generateRoomCode(6);
  const path = `companionRooms/${roomCode}`;
  const ref = doc(db, 'companionRooms', roomCode);
  const safeSurah = Math.max(
    1,
    Math.min(114, Math.round(params.sharedSurahNumber || 1))
  );
  const safeAyah = Math.max(
    1,
    Math.min(286, Math.round(params.sharedAyahNumber || 1))
  );
  const safeTitle = (params.title.trim() || 'مجلس حفظ ومنافسة').slice(0, 100);

  try {
    const nowMs = Date.now();
    await setDoc(ref, {
      roomCode,
      title: safeTitle,
      hostUid: uid,
      hostName: displayName || 'المضيف',
      guestUid: '',
      guestName: '',
      status: 'waiting',
      mode: params.mode,
      questionIds: safeIds,
      hostScore: 0,
      guestScore: 0,
      hostAnsweredCount: 0,
      guestAnsweredCount: 0,
      sharedSurahNumber: safeSurah,
      sharedAyahNumber: safeAyah,
      currentQuestionIndex: 0,
      hostAnswerForCurrent: -1,
      guestAnswerForCurrent: -1,
      hostReady: true,
      guestReady: false,
      questionStartedAtMs: nowMs,
      liveEventText: 'تم إنشاء الغرفة وبانتظار دخول صديقك لبدء التنافس الحي',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const createdSnap = await getDoc(ref);
    return mapRoomDoc(roomCode, (createdSnap.data() || {}) as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinCompanionRoom(
  user: User,
  rawCode: string
): Promise<CompanionRoomRecord> {
  const roomCode = normalizeRoomCode(rawCode);
  if (!/^[A-Z0-9]{6,12}$/.test(roomCode)) {
    throw new Error('رمز الغرفة يجب أن يتكون من ٦ إلى ١٢ حرفاً أو رقماً بالإنجليزية');
  }
  const path = `companionRooms/${roomCode}`;
  const ref = doc(db, 'companionRooms', roomCode);
  try {
    const guestName = (user.displayName || 'صديقك')
      .trim()
      .slice(0, 80) || 'صديقك';

    const joinedRoom = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('لم يتم العثور على غرفة بهذا الرمز، تأكد من الرمز الصحيح');
      }
      const rawData = snap.data() as Record<string, unknown>;
      if (typeof rawData.currentQuestionIndex !== 'number') {
        throw new Error('هذه الغرفة من إصدار سابق، أنشئ غرفة جديدة للتنافس الحي');
      }
      const room = mapRoomDoc(roomCode, rawData);
      if (room.hostUid === user.uid || room.guestUid === user.uid) {
        return room;
      }
      if (room.guestUid !== '' || room.status !== 'waiting') {
        throw new Error('هذه الغرفة مكتملة العدد حالياً بمشارك آخر');
      }

      const startedMs = Date.now();
      const eventText = `انضم ${guestName} — بدأت المنافسة الحية!`.slice(0, 200);
      tx.update(ref, {
        guestUid: user.uid,
        guestName,
        guestReady: true,
        status: 'active',
        questionStartedAtMs: startedMs,
        liveEventText: eventText,
        updatedAt: serverTimestamp(),
      });

      return {
        ...room,
        guestUid: user.uid,
        guestName,
        guestReady: true,
        status: 'active' as CompanionRoomStatus,
        questionStartedAtMs: startedMs,
        liveEventText: eventText,
      };
    });

    return joinedRoom;
  } catch (error) {
    if (
      error instanceof Error &&
      !error.message.toLowerCase().includes('permission')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchMyCompanionRooms(
  uid: string
): Promise<CompanionRoomRecord[]> {
  const path = 'companionRooms';
  try {
    const hostQ = query(
      collection(db, 'companionRooms'),
      where('hostUid', '==', uid),
      limit(10)
    );
    const guestQ = query(
      collection(db, 'companionRooms'),
      where('guestUid', '==', uid),
      limit(10)
    );
    const [hostSnap, guestSnap] = await Promise.all([
      getDocs(hostQ),
      getDocs(guestQ),
    ]);

    const byCode = new Map<string, CompanionRoomRecord>();
    for (const d of [...hostSnap.docs, ...guestSnap.docs]) {
      const raw = d.data() as Record<string, unknown>;
      if (typeof raw.currentQuestionIndex !== 'number') continue;
      byCode.set(d.id, mapRoomDoc(d.id, raw));
    }
    return Array.from(byCode.values()).sort(
      (a, b) => b.updatedAtMs - a.updatedAtMs
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToCompanionRoom(
  roomCode: string,
  onData: (room: CompanionRoomRecord | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `companionRooms/${roomCode}`;
  const ref = doc(db, 'companionRooms', roomCode);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapRoomDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToRoomMessages(
  roomCode: string,
  onData: (messages: CompanionMessageRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `companionRooms/${roomCode}/messages`;
  const q = query(
    collection(db, 'companionRooms', roomCode, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(60)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CompanionMessageRecord[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt as { toMillis?: () => number } | undefined;
        return {
          id: String(data.id || d.id),
          uid: String(data.uid || ''),
          senderName: String(data.senderName || 'قارئ'),
          kind:
            data.kind === 'nudge' || data.kind === 'ayah_share'
              ? data.kind
              : 'chat',
          text: String(data.text || ''),
          surahNumber: Number(data.surahNumber || 1),
          ayahNumber: Number(data.ayahNumber || 1),
          createdAtMs: typeof ts?.toMillis === 'function' ? ts.toMillis() : 0,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function sendRoomMessage(params: {
  roomCode: string;
  user: User;
  kind: CompanionMessageKind;
  text: string;
  surahNumber?: number;
  ayahNumber?: number;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, 400);
  if (!cleanText) return;
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    64
  );
  const path = `companionRooms/${params.roomCode}/messages/${msgId}`;
  const ref = doc(db, 'companionRooms', params.roomCode, 'messages', msgId);
  try {
    await setDoc(ref, {
      id: msgId,
      uid: params.user.uid,
      senderName: (params.user.displayName || 'صديقك').trim().slice(0, 80) || 'صديقك',
      kind: params.kind,
      text: cleanText,
      surahNumber: Math.max(1, Math.min(114, Math.round(params.surahNumber || 1))),
      ayahNumber: Math.max(1, Math.min(286, Math.round(params.ayahNumber || 1))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncLiveAnswerToLeaderboard(params: {
  user: User;
  pointsEarned: number;
  answerKey: string;
}): Promise<{ awarded: boolean; deltaPoints: number }> {
  const deltaPoints = Math.max(0, Math.min(25, Math.round(params.pointsEarned)));
  if (deltaPoints === 0 || hasAwardedRoundKey(params.answerKey)) {
    return { awarded: false, deltaPoints: 0 };
  }

  const uid = params.user.uid;
  const path = `leaderboard/${uid}`;
  const ref = doc(db, 'leaderboard', uid);
  const weekKey = getCurrentWeekKey();
  const monthKey = getCurrentMonthKey();
  const displayName =
    (params.user.displayName || params.user.email?.split('@')[0] || 'متسابق القرآن')
      .trim()
      .slice(0, 80) || 'متسابق القرآن';
  const photoURL = (params.user.photoURL || '').slice(0, 500);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          uid,
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: deltaPoints,
          monthlyPoints: deltaPoints,
          totalPoints: deltaPoints,
          winsCount: 0,
          roundsCount: 0,
          bestStreak: 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        const existing = mapLeaderboardDoc(
          uid,
          snap.data() as Record<string, unknown>
        );
        const nextWeekly =
          existing.weekKey === weekKey
            ? Math.min(50000, existing.weeklyPoints + deltaPoints)
            : deltaPoints;
        const nextMonthly =
          existing.monthKey === monthKey
            ? Math.min(200000, existing.monthlyPoints + deltaPoints)
            : deltaPoints;
        const nextTotal = Math.min(2000000, existing.totalPoints + deltaPoints);

        tx.update(ref, {
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: nextWeekly,
          monthlyPoints: nextMonthly,
          totalPoints: nextTotal,
          winsCount: existing.winsCount,
          roundsCount: existing.roundsCount,
          bestStreak: Math.max(existing.bestStreak, 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    markRoundKeyAwarded(params.answerKey);
    return { awarded: true, deltaPoints };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitLiveRoomAnswer(params: {
  roomCode: string;
  user: User;
  questionIndex: number;
  optionIdx: number;
  isCorrect: boolean;
}): Promise<{
  submitted: boolean;
  pointsEarned: number;
  bothAnswered: boolean;
}> {
  const { roomCode, user, questionIndex, optionIdx, isCorrect } = params;
  const path = `companionRooms/${roomCode}`;
  const ref = doc(db, 'companionRooms', roomCode);
  const clampedOpt = Math.max(-2, Math.min(3, Math.round(optionIdx)));

  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return {
          submitted: false,
          pointsEarned: 0,
          bothAnswered: false,
          answerKey: '',
        };
      }
      const room = mapRoomDoc(roomCode, snap.data() as Record<string, unknown>);
      if (room.status !== 'active' || room.currentQuestionIndex !== questionIndex) {
        return {
          submitted: false,
          pointsEarned: 0,
          bothAnswered: false,
          answerKey: '',
        };
      }

      const isHost = room.hostUid === user.uid;
      const isGuest = room.guestUid === user.uid;
      if (!isHost && !isGuest) {
        return {
          submitted: false,
          pointsEarned: 0,
          bothAnswered: false,
          answerKey: '',
        };
      }

      const myCurrentAns = isHost
        ? room.hostAnswerForCurrent
        : room.guestAnswerForCurrent;
      if (myCurrentAns !== -1) {
        return {
          submitted: false,
          pointsEarned: 0,
          bothAnswered:
            room.hostAnswerForCurrent !== -1 && room.guestAnswerForCurrent !== -1,
          answerKey: '',
        };
      }

      const otherCurrentAns = isHost
        ? room.guestAnswerForCurrent
        : room.hostAnswerForCurrent;
      const isFirstToAnswer = otherCurrentAns === -1;
      const pointsEarned =
        clampedOpt >= 0 && isCorrect ? (isFirstToAnswer ? 15 : 10) : 0;

      const playerName = (isHost ? room.hostName : room.guestName) || 'متسابق';
      const eventText =
        clampedOpt === -2
          ? `انتهى وقت السؤال للاعب ${playerName}`.slice(0, 200)
          : pointsEarned > 0
          ? `أجاب ${playerName} إجابة صحيحة (+${pointsEarned} نقطة)!`.slice(0, 200)
          : `أجاب ${playerName} على السؤال الحالي`.slice(0, 200);

      const qId = room.questionIds[questionIndex] || String(questionIndex);
      const answerKey = `live_${roomCode}_${questionIndex}_${qId}`;

      if (isHost) {
        tx.update(ref, {
          hostScore: Math.min(1200, room.hostScore + pointsEarned),
          hostAnsweredCount: Math.min(
            Math.max(1, room.questionIds.length),
            room.hostAnsweredCount + 1
          ),
          hostAnswerForCurrent: clampedOpt,
          hostReady: true,
          liveEventText: eventText,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          guestScore: Math.min(1200, room.guestScore + pointsEarned),
          guestAnsweredCount: Math.min(
            Math.max(1, room.questionIds.length),
            room.guestAnsweredCount + 1
          ),
          guestAnswerForCurrent: clampedOpt,
          guestReady: true,
          liveEventText: eventText,
          updatedAt: serverTimestamp(),
        });
      }

      return {
        submitted: true,
        pointsEarned,
        bothAnswered: otherCurrentAns !== -1,
        answerKey,
      };
    });

    if (outcome.submitted && outcome.pointsEarned > 0 && outcome.answerKey) {
      await syncLiveAnswerToLeaderboard({
        user,
        pointsEarned: outcome.pointsEarned,
        answerKey: outcome.answerKey,
      });
    }

    return {
      submitted: outcome.submitted,
      pointsEarned: outcome.pointsEarned,
      bothAnswered: outcome.bothAnswered,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function advanceLiveRoomQuestion(params: {
  roomCode: string;
  expectedQuestionIndex: number;
}): Promise<boolean> {
  const { roomCode, expectedQuestionIndex } = params;
  const path = `companionRooms/${roomCode}`;
  const ref = doc(db, 'companionRooms', roomCode);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const room = mapRoomDoc(roomCode, snap.data() as Record<string, unknown>);
      if (
        room.status !== 'active' ||
        room.guestUid === '' ||
        room.currentQuestionIndex !== expectedQuestionIndex ||
        room.hostAnswerForCurrent === -1 ||
        room.guestAnswerForCurrent === -1
      ) {
        return false;
      }

      const totalQ = Math.max(1, room.questionIds.length);
      if (expectedQuestionIndex + 1 >= totalQ) {
        tx.update(ref, {
          status: 'finished',
          liveEventText: 'انتهت الجولة التنافسية! يتم الآن احتساب مكافأة الفوز',
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          currentQuestionIndex: expectedQuestionIndex + 1,
          hostAnswerForCurrent: -1,
          guestAnswerForCurrent: -1,
          questionStartedAtMs: Date.now(),
          liveEventText: `انتقل المتنافسان إلى السؤال ${expectedQuestionIndex + 2}`,
          updatedAt: serverTimestamp(),
        });
      }
      return true;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function shareRoomAyah(params: {
  room: CompanionRoomRecord;
  user: User;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
}): Promise<void> {
  const safeSurah = Math.max(1, Math.min(114, Math.round(params.surahNumber || 1)));
  const safeAyah = Math.max(1, Math.min(286, Math.round(params.ayahNumber || 1)));
  const path = `companionRooms/${params.room.roomCode}`;
  try {
    await updateDoc(doc(db, 'companionRooms', params.room.roomCode), {
      sharedSurahNumber: safeSurah,
      sharedAyahNumber: safeAyah,
      updatedAt: serverTimestamp(),
    });
    await sendRoomMessage({
      roomCode: params.room.roomCode,
      user: params.user,
      kind: 'ayah_share',
      text: `دعاك لمراجعة وقراءة ${params.surahName} — الآية ${safeAyah}`,
      surahNumber: safeSurah,
      ayahNumber: safeAyah,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function startRoomRematch(params: {
  room: CompanionRoomRecord;
  mode: CompanionRoomMode;
  questionIds: string[];
}): Promise<void> {
  const path = `companionRooms/${params.room.roomCode}`;
  const ref = doc(db, 'companionRooms', params.room.roomCode);
  try {
    await updateDoc(ref, {
      mode: params.mode,
      questionIds: params.questionIds.slice(0, 12),
      hostScore: 0,
      guestScore: 0,
      hostAnsweredCount: 0,
      guestAnsweredCount: 0,
      currentQuestionIndex: 0,
      hostAnswerForCurrent: -1,
      guestAnswerForCurrent: -1,
      questionStartedAtMs: Date.now(),
      liveEventText: 'بدأت جولة تحدٍ جديدة ومباشرة!',
      status: params.room.guestUid ? 'active' : 'waiting',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCompanionRoom(roomCode: string): Promise<void> {
  const path = `companionRooms/${roomCode}`;
  try {
    await deleteDoc(doc(db, 'companionRooms', roomCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== LEADERBOARD & POINTS SYSTEM ====================

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all';

export interface LeaderboardEntryRecord {
  uid: string;
  displayName: string;
  photoURL: string;
  weekKey: string;
  monthKey: string;
  weeklyPoints: number;
  monthlyPoints: number;
  totalPoints: number;
  winsCount: number;
  roundsCount: number;
  bestStreak: number;
  updatedAtMs: number;
}

const AWARDED_ROUNDS_KEY = 'quran_awarded_rounds_v1';

export function getCurrentWeekKey(date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function hasAwardedRoundKey(roundKey: string): boolean {
  try {
    const raw = localStorage.getItem(AWARDED_ROUNDS_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(roundKey);
  } catch {
    return false;
  }
}

function markRoundKeyAwarded(roundKey: string): void {
  try {
    const raw = localStorage.getItem(AWARDED_ROUNDS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    const safeList = Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string')
      : [];
    if (!safeList.includes(roundKey)) {
      const updated = [roundKey, ...safeList].slice(0, 60);
      localStorage.setItem(AWARDED_ROUNDS_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore storage errors
  }
}

function safeNonNegativeInt(val: unknown): number {
  const num = Number(val);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function mapLeaderboardDoc(
  docId: string,
  data: Record<string, unknown>
): LeaderboardEntryRecord {
  const ts = data.updatedAt as { toMillis?: () => number } | undefined;
  return {
    uid: String(data.uid || docId),
    displayName: String(data.displayName || 'متسابق القرآن'),
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
    weekKey: String(data.weekKey || getCurrentWeekKey()),
    monthKey: String(data.monthKey || getCurrentMonthKey()),
    weeklyPoints: safeNonNegativeInt(data.weeklyPoints),
    monthlyPoints: safeNonNegativeInt(data.monthlyPoints),
    totalPoints: safeNonNegativeInt(data.totalPoints),
    winsCount: safeNonNegativeInt(data.winsCount),
    roundsCount: safeNonNegativeInt(data.roundsCount),
    bestStreak: safeNonNegativeInt(data.bestStreak),
    updatedAtMs: typeof ts?.toMillis === 'function' ? ts.toMillis() : 0,
  };
}

export async function awardCompetitionPoints(params: {
  user: User;
  pointsEarned: number;
  isWin: boolean;
  bestStreak?: number;
  roundKey: string;
}): Promise<{
  awarded: boolean;
  deltaPoints: number;
  entry: LeaderboardEntryRecord | null;
}> {
  const deltaPoints = Math.max(
    1,
    Math.min(250, Math.round(params.pointsEarned))
  );
  if (hasAwardedRoundKey(params.roundKey)) {
    return { awarded: false, deltaPoints: 0, entry: null };
  }

  const uid = params.user.uid;
  const path = `leaderboard/${uid}`;
  const ref = doc(db, 'leaderboard', uid);
  const weekKey = getCurrentWeekKey();
  const monthKey = getCurrentMonthKey();
  const displayName =
    (params.user.displayName || params.user.email?.split('@')[0] || 'متسابق القرآن')
      .trim()
      .slice(0, 80) || 'متسابق القرآن';
  const photoURL = (params.user.photoURL || '').slice(0, 500);
  const safeStreak = Math.max(0, Math.min(500, Math.round(params.bestStreak || 0)));

  try {
    const projectedEntry = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const nextWins = params.isWin ? 1 : 0;
        tx.set(ref, {
          uid,
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: deltaPoints,
          monthlyPoints: deltaPoints,
          totalPoints: deltaPoints,
          winsCount: nextWins,
          roundsCount: 1,
          bestStreak: safeStreak,
          updatedAt: serverTimestamp(),
        });
        return {
          uid,
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: deltaPoints,
          monthlyPoints: deltaPoints,
          totalPoints: deltaPoints,
          winsCount: nextWins,
          roundsCount: 1,
          bestStreak: safeStreak,
          updatedAtMs: Date.now(),
        } satisfies LeaderboardEntryRecord;
      }

      const existing = mapLeaderboardDoc(
        uid,
        snap.data() as Record<string, unknown>
      );
      const nextWeekly =
        existing.weekKey === weekKey
          ? Math.min(50000, existing.weeklyPoints + deltaPoints)
          : deltaPoints;
      const nextMonthly =
        existing.monthKey === monthKey
          ? Math.min(200000, existing.monthlyPoints + deltaPoints)
          : deltaPoints;
      const nextTotal = Math.min(2000000, existing.totalPoints + deltaPoints);
      const nextWins = Math.min(
        50000,
        existing.winsCount + (params.isWin ? 1 : 0)
      );
      const nextRounds = Math.min(100000, existing.roundsCount + 1);
      const nextStreak = Math.max(existing.bestStreak, safeStreak);

      tx.update(ref, {
        displayName,
        photoURL,
        weekKey,
        monthKey,
        weeklyPoints: nextWeekly,
        monthlyPoints: nextMonthly,
        totalPoints: nextTotal,
        winsCount: nextWins,
        roundsCount: nextRounds,
        bestStreak: nextStreak,
        updatedAt: serverTimestamp(),
      });

      return {
        uid,
        displayName,
        photoURL,
        weekKey,
        monthKey,
        weeklyPoints: nextWeekly,
        monthlyPoints: nextMonthly,
        totalPoints: nextTotal,
        winsCount: nextWins,
        roundsCount: nextRounds,
        bestStreak: nextStreak,
        updatedAtMs: Date.now(),
      } satisfies LeaderboardEntryRecord;
    });

    markRoundKeyAwarded(params.roundKey);
    return { awarded: true, deltaPoints, entry: projectedEntry };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToLeaderboard(
  onData: (entries: LeaderboardEntryRecord[]) => void,
  onError?: (err: Error) => void,
  options?: { period?: LeaderboardPeriod; maxEntries?: number }
): () => void {
  const path = 'leaderboard';
  const period = options?.period ?? 'all';
  const maxEntries = Math.max(10, Math.min(100, options?.maxEntries ?? 100));
  const sortField =
    period === 'weekly'
      ? 'weeklyPoints'
      : period === 'monthly'
      ? 'monthlyPoints'
      : 'totalPoints';

  const q = query(
    collection(db, 'leaderboard'),
    orderBy(sortField, 'desc'),
    limit(maxEntries)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) =>
        mapLeaderboardDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToMyLeaderboardEntry(
  uid: string,
  onData: (entry: LeaderboardEntryRecord | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `leaderboard/${uid}`;
  const ref = doc(db, 'leaderboard', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapLeaderboardDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

// ==================== DAILY STREAKS CLOUD SYNC ====================

export async function loadUserStreakState(
  uid: string
): Promise<DailyStreakState | null> {
  const path = `users/${uid}/sync/streak`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'sync', 'streak'));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const todayDate = typeof data.todayDate === 'string' ? data.todayDate : '';
    const recentActiveDates = Array.isArray(data.recentActiveDates)
      ? data.recentActiveDates.filter((d): d is string => typeof d === 'string').slice(-35)
      : [];
    const celebratedMilestones = Array.isArray(data.celebratedMilestones)
      ? data.celebratedMilestones.filter((m): m is number => typeof m === 'number').slice(-30)
      : [];

    const dailyLogs: DailyStreakState['dailyLogs'] = {};
    for (const dKey of recentActiveDates) {
      dailyLogs[dKey] = {
        date: dKey,
        quranDone: true,
        tasbeehDone: false,
        rewardClaimed: dKey !== todayDate,
        pointsEarned: 0,
      };
    }
    if (todayDate) {
      const todayQuranDone = Boolean(data.todayQuranDone);
      const todayTasbeehDone = Boolean(data.todayTasbeehDone);
      const todayRewardClaimed = Boolean(data.todayRewardClaimed);
      if (todayQuranDone || todayTasbeehDone || todayRewardClaimed) {
        dailyLogs[todayDate] = {
          date: todayDate,
          quranDone: todayQuranDone,
          tasbeehDone: todayTasbeehDone,
          rewardClaimed: todayRewardClaimed,
          pointsEarned: 0,
        };
      } else {
        delete dailyLogs[todayDate];
      }
    }

    return {
      currentStreak: Math.max(0, Number(data.currentStreak || 0)),
      longestStreak: Math.max(0, Number(data.longestStreak || 0)),
      lastActiveDate: typeof data.lastActiveDate === 'string' ? data.lastActiveDate : '',
      totalActiveDays: Math.max(0, Number(data.totalActiveDays || 0)),
      totalStreakPoints: Math.max(0, Number(data.totalStreakPoints || 0)),
      celebratedMilestones,
      dailyLogs,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserStreakState(
  uid: string,
  streak: DailyStreakState,
  todayDate: string
): Promise<void> {
  const path = `users/${uid}/sync/streak`;
  const ref = doc(db, 'users', uid, 'sync', 'streak');
  const todayLog = streak.dailyLogs[todayDate];
  const recentActiveDates = Object.entries(streak.dailyLogs)
    .filter(([, log]) => log.quranDone || log.tasbeehDone)
    .map(([dateKey]) => dateKey)
    .sort()
    .slice(-35);
  const safeMilestones = (streak.celebratedMilestones || [])
    .filter((n) => Number.isInteger(n) && n >= 7 && n <= 10000)
    .slice(-30);

  const mutableData = {
    currentStreak: Math.max(0, Math.min(10000, Math.round(streak.currentStreak || 0))),
    longestStreak: Math.max(0, Math.min(10000, Math.round(streak.longestStreak || 0))),
    lastActiveDate: (streak.lastActiveDate || '').slice(0, 16),
    totalActiveDays: Math.max(0, Math.min(10000, Math.round(streak.totalActiveDays || 0))),
    totalStreakPoints: Math.max(
      0,
      Math.min(1000000, Math.round(streak.totalStreakPoints || 0))
    ),
    todayDate: todayDate.slice(0, 16),
    todayQuranDone: Boolean(todayLog?.quranDone),
    todayTasbeehDone: Boolean(todayLog?.tasbeehDone),
    todayRewardClaimed: Boolean(todayLog?.rewardClaimed),
    celebratedMilestones: safeMilestones,
    recentActiveDates,
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, ...mutableData });
    } else {
      await updateDoc(ref, mutableData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function awardDailyStreakLeaderboardBonus(params: {
  user: User;
  pointsEarned: number;
  bestStreak: number;
  dateKey: string;
}): Promise<{ awarded: boolean; deltaPoints: number }> {
  const deltaPoints = Math.max(
    1,
    Math.min(250, Math.round(params.pointsEarned))
  );
  const rewardKey = `daily_streak_${params.dateKey}`;
  if (hasAwardedRoundKey(rewardKey)) {
    return { awarded: false, deltaPoints: 0 };
  }

  const uid = params.user.uid;
  const path = `leaderboard/${uid}`;
  const ref = doc(db, 'leaderboard', uid);
  const weekKey = getCurrentWeekKey();
  const monthKey = getCurrentMonthKey();
  const displayName =
    (params.user.displayName || params.user.email?.split('@')[0] || 'متسابق القرآن')
      .trim()
      .slice(0, 80) || 'متسابق القرآن';
  const photoURL = (params.user.photoURL || '').slice(0, 500);
  const safeStreak = Math.max(0, Math.min(500, Math.round(params.bestStreak || 0)));

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          uid,
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: deltaPoints,
          monthlyPoints: deltaPoints,
          totalPoints: deltaPoints,
          winsCount: 0,
          roundsCount: 0,
          bestStreak: safeStreak,
          updatedAt: serverTimestamp(),
        });
      } else {
        const existing = mapLeaderboardDoc(
          uid,
          snap.data() as Record<string, unknown>
        );
        const nextWeekly =
          existing.weekKey === weekKey
            ? Math.min(50000, existing.weeklyPoints + deltaPoints)
            : deltaPoints;
        const nextMonthly =
          existing.monthKey === monthKey
            ? Math.min(200000, existing.monthlyPoints + deltaPoints)
            : deltaPoints;
        const nextTotal = Math.min(2000000, existing.totalPoints + deltaPoints);

        tx.update(ref, {
          displayName,
          photoURL,
          weekKey,
          monthKey,
          weeklyPoints: nextWeekly,
          monthlyPoints: nextMonthly,
          totalPoints: nextTotal,
          winsCount: existing.winsCount,
          roundsCount: existing.roundsCount,
          bestStreak: Math.max(existing.bestStreak, safeStreak),
          updatedAt: serverTimestamp(),
        });
      }
    });

    markRoundKeyAwarded(rewardKey);
    return { awarded: true, deltaPoints };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==================== GROUP KHATMAH (الختمات الجماعية) ====================

export function normalizeGroupCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function mapGroupKhatmahDoc(
  docId: string,
  data: Record<string, unknown>
): GroupKhatmahRecord {
  const createdTs = data.createdAt as { toMillis?: () => number } | undefined;
  const updatedTs = data.updatedAt as { toMillis?: () => number } | undefined;
  const createdAtMs =
    typeof createdTs?.toMillis === 'function' ? createdTs.toMillis() : 0;
  const updatedAtMs =
    typeof updatedTs?.toMillis === 'function'
      ? updatedTs.toMillis()
      : createdAtMs;

  return {
    groupCode: String(data.groupCode || docId),
    title: String(data.title || 'ختمة جماعية مباركة'),
    description: typeof data.description === 'string' ? data.description : '',
    creatorUid: String(data.creatorUid || ''),
    creatorName: String(data.creatorName || 'قارئ القرآن'),
    targetDays: Math.max(1, Math.min(365, Number(data.targetDays || 30))),
    memberUids: Array.isArray(data.memberUids)
      ? data.memberUids.filter((id): id is string => typeof id === 'string')
      : [],
    status: data.status === 'completed' ? 'completed' : 'active',
    createdAtMs,
    updatedAtMs,
  };
}

function mapGroupKhatmahMemberDoc(
  docId: string,
  data: Record<string, unknown>
): GroupKhatmahMemberRecord {
  const joinedTs = data.joinedAt as { toMillis?: () => number } | undefined;
  const updatedTs = data.updatedAt as { toMillis?: () => number } | undefined;
  const joinedAtMs =
    typeof joinedTs?.toMillis === 'function' ? joinedTs.toMillis() : 0;
  const updatedAtMs =
    typeof updatedTs?.toMillis === 'function'
      ? updatedTs.toMillis()
      : joinedAtMs;

  const rawJuz = Array.isArray(data.completedJuz) ? data.completedJuz : [];
  const completedJuz = Array.from(
    new Set(
      rawJuz
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
    )
  ).sort((a, b) => a - b);

  return {
    uid: String(data.uid || docId),
    groupCode: String(data.groupCode || ''),
    displayName: String(data.displayName || 'مشارك'),
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
    completedJuz,
    currentPage: Math.max(1, Math.min(604, Number(data.currentPage || 1))),
    joinedAtMs,
    updatedAtMs,
  };
}

export async function createGroupKhatmah(params: {
  user: User;
  title: string;
  description?: string;
  targetDays?: number;
  initialCompletedJuz?: number[];
  initialCurrentPage?: number;
}): Promise<GroupKhatmahRecord> {
  const uid = params.user.uid;
  const groupCode = generateRoomCode(6);
  const groupPath = `groupKhatmahs/${groupCode}`;
  const groupRef = doc(db, 'groupKhatmahs', groupCode);

  const safeTitle = (params.title.trim() || 'ختمة جماعية مباركة').slice(0, 100);
  const safeDesc = (params.description || '').trim().slice(0, 200);
  const creatorName =
    (params.user.displayName || params.user.email?.split('@')[0] || 'قارئ القرآن')
      .trim()
      .slice(0, 80) || 'قارئ القرآن';
  const safeDays = Math.max(1, Math.min(365, Math.round(params.targetDays || 30)));
  const photoURL = (params.user.photoURL || '').slice(0, 500);

  const safeJuz = Array.from(
    new Set(
      (params.initialCompletedJuz || []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= 30
      )
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 30);
  const safePage = Math.max(
    1,
    Math.min(604, Math.round(params.initialCurrentPage || 1))
  );

  try {
    await setDoc(groupRef, {
      groupCode,
      title: safeTitle,
      description: safeDesc,
      creatorUid: uid,
      creatorName,
      targetDays: safeDays,
      memberUids: [uid],
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, groupPath);
  }

  const memberPath = `groupKhatmahs/${groupCode}/members/${uid}`;
  const memberRef = doc(db, 'groupKhatmahs', groupCode, 'members', uid);
  try {
    await setDoc(memberRef, {
      uid,
      groupCode,
      displayName: creatorName,
      photoURL,
      completedJuz: safeJuz,
      currentPage: safePage,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, memberPath);
  }

  try {
    const snap = await getDoc(groupRef);
    return mapGroupKhatmahDoc(
      groupCode,
      (snap.data() || {}) as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, groupPath);
  }
}

export async function joinGroupKhatmah(params: {
  user: User;
  rawCode: string;
  initialCompletedJuz?: number[];
  initialCurrentPage?: number;
}): Promise<GroupKhatmahRecord> {
  const groupCode = normalizeGroupCode(params.rawCode);
  if (!/^[A-Z0-9]{6,12}$/.test(groupCode)) {
    throw new Error('رمز المجموعة يجب أن يتكون من ٦ إلى ١٢ حرفاً أو رقماً بالإنجليزية');
  }

  const uid = params.user.uid;
  const groupPath = `groupKhatmahs/${groupCode}`;
  const groupRef = doc(db, 'groupKhatmahs', groupCode);

  let joinedGroup: GroupKhatmahRecord;
  try {
    joinedGroup = await runTransaction(db, async (tx) => {
      const snap = await tx.get(groupRef);
      if (!snap.exists()) {
        throw new Error('لم يتم العثور على ختمة جماعية بهذا الرمز');
      }
      const mapped = mapGroupKhatmahDoc(
        groupCode,
        snap.data() as Record<string, unknown>
      );
      if (mapped.memberUids.includes(uid)) {
        return mapped;
      }
      if (mapped.status !== 'active') {
        throw new Error('هذه الختمة الجماعية قد اكتملت بالفعل');
      }
      if (mapped.memberUids.length >= 50) {
        throw new Error('وصلت المجموعة إلى الحد الأقصى من الأعضاء (٥٠ عضواً)');
      }

      const nextMembers = [...mapped.memberUids, uid];
      tx.update(groupRef, {
        memberUids: nextMembers,
        updatedAt: serverTimestamp(),
      });
      return {
        ...mapped,
        memberUids: nextMembers,
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      !error.message.toLowerCase().includes('permission')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, groupPath);
  }

  const memberPath = `groupKhatmahs/${groupCode}/members/${uid}`;
  const memberRef = doc(db, 'groupKhatmahs', groupCode, 'members', uid);
  try {
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      const displayName =
        (params.user.displayName || params.user.email?.split('@')[0] || 'مشارك')
          .trim()
          .slice(0, 80) || 'مشارك';
      const photoURL = (params.user.photoURL || '').slice(0, 500);
      const safeJuz = Array.from(
        new Set(
          (params.initialCompletedJuz || []).filter(
            (n) => Number.isInteger(n) && n >= 1 && n <= 30
          )
        )
      )
        .sort((a, b) => a - b)
        .slice(0, 30);
      const safePage = Math.max(
        1,
        Math.min(604, Math.round(params.initialCurrentPage || 1))
      );

      await setDoc(memberRef, {
        uid,
        groupCode,
        displayName,
        photoURL,
        completedJuz: safeJuz,
        currentPage: safePage,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  return joinedGroup;
}

export async function fetchMyGroupKhatmahs(
  uid: string
): Promise<GroupKhatmahRecord[]> {
  const path = 'groupKhatmahs';
  try {
    const q = query(
      collection(db, 'groupKhatmahs'),
      where('memberUids', 'array-contains', uid),
      limit(25)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapGroupKhatmahDoc(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToGroupKhatmah(
  groupCode: string,
  onData: (group: GroupKhatmahRecord | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `groupKhatmahs/${groupCode}`;
  const ref = doc(db, 'groupKhatmahs', groupCode);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapGroupKhatmahDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToGroupKhatmahMembers(
  groupCode: string,
  onData: (members: GroupKhatmahMemberRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `groupKhatmahs/${groupCode}/members`;
  const q = query(
    collection(db, 'groupKhatmahs', groupCode, 'members'),
    orderBy('joinedAt', 'asc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const members = snap.docs.map((d) =>
        mapGroupKhatmahMemberDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(members);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateGroupMemberProgress(params: {
  groupCode: string;
  user: User;
  completedJuz: number[];
  currentPage: number;
}): Promise<void> {
  const uid = params.user.uid;
  const path = `groupKhatmahs/${params.groupCode}/members/${uid}`;
  const ref = doc(db, 'groupKhatmahs', params.groupCode, 'members', uid);
  const displayName =
    (params.user.displayName || params.user.email?.split('@')[0] || 'مشارك')
      .trim()
      .slice(0, 80) || 'مشارك';
  const photoURL = (params.user.photoURL || '').slice(0, 500);
  const safeJuz = Array.from(
    new Set(
      params.completedJuz.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 30);
  const safePage = Math.max(
    1,
    Math.min(604, Math.round(params.currentPage || 1))
  );

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        groupCode: params.groupCode,
        displayName,
        photoURL,
        completedJuz: safeJuz,
        currentPage: safePage,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        photoURL,
        completedJuz: safeJuz,
        currentPage: safePage,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateGroupKhatmahStatus(
  groupCode: string,
  status: GroupKhatmahStatus
): Promise<void> {
  const path = `groupKhatmahs/${groupCode}`;
  try {
    await updateDoc(doc(db, 'groupKhatmahs', groupCode), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leaveGroupKhatmah(
  groupCode: string,
  user: User
): Promise<void> {
  const uid = user.uid;
  const groupPath = `groupKhatmahs/${groupCode}`;
  const groupRef = doc(db, 'groupKhatmahs', groupCode);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(groupRef);
      if (!snap.exists()) return;
      const group = mapGroupKhatmahDoc(
        groupCode,
        snap.data() as Record<string, unknown>
      );
      if (group.creatorUid === uid) {
        throw new Error('لا يمكن لمنشئ المجموعة المغادرة؛ يمكنك حذف المجموعة بدلاً من ذلك');
      }
      if (!group.memberUids.includes(uid)) return;
      const nextMembers = group.memberUids.filter((id) => id !== uid);
      tx.update(groupRef, {
        memberUids: nextMembers,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      !error.message.toLowerCase().includes('permission')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, groupPath);
  }

  const memberPath = `groupKhatmahs/${groupCode}/members/${uid}`;
  try {
    await deleteDoc(doc(db, 'groupKhatmahs', groupCode, 'members', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, memberPath);
  }
}

export async function deleteGroupKhatmah(
  groupCode: string,
  memberUids: string[]
): Promise<void> {
  const path = `groupKhatmahs/${groupCode}`;
  try {
    await Promise.allSettled(
      memberUids.map((uid) =>
        deleteDoc(doc(db, 'groupKhatmahs', groupCode, 'members', uid))
      )
    );
    await deleteDoc(doc(db, 'groupKhatmahs', groupCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== MULTIPLE PERSONAL KHATMAHS ====================

export async function loadUserPersonalKhatmahs(
  uid: string
): Promise<PersonalKhatmahRecord[]> {
  const path = `users/${uid}/khatmahs`;
  try {
    const q = query(
      collection(db, 'users', uid, 'khatmahs'),
      where('uid', '==', uid),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        const rawJuz = Array.isArray(data.completedJuz) ? data.completedJuz : [];
        const completedJuz = Array.from(
          new Set(
            rawJuz
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
          )
        ).sort((a, b) => a - b);
        const updatedTs = data.updatedAt as { toMillis?: () => number } | undefined;
        const startedAtMs = Math.max(0, Number(data.startedAtMs || Date.now()));
        const updatedAt =
          typeof updatedTs?.toMillis === 'function'
            ? updatedTs.toMillis()
            : startedAtMs;

        return {
          id: String(data.id || d.id),
          name: String(data.name || 'الختمة الرئيسية'),
          targetDays: Math.max(1, Math.min(365, Number(data.targetDays || 30))),
          currentPage: Math.max(1, Math.min(604, Number(data.currentPage || 1))),
          completedJuz,
          startedAt: startedAtMs,
          updatedAt,
        } satisfies PersonalKhatmahRecord;
      })
      .sort((a, b) => a.startedAt - b.startedAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function upsertCloudPersonalKhatmah(
  uid: string,
  record: PersonalKhatmahRecord
): Promise<void> {
  const safeId = record.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safeId) return;
  const path = `users/${uid}/khatmahs/${safeId}`;
  const ref = doc(db, 'users', uid, 'khatmahs', safeId);

  const safeName = (record.name.trim() || 'ختمة قرآنية').slice(0, 80);
  const safeDays = Math.max(1, Math.min(365, Math.round(record.targetDays || 30)));
  const safePage = Math.max(1, Math.min(604, Math.round(record.currentPage || 1)));
  const safeJuz = Array.from(
    new Set(
      (record.completedJuz || []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= 30
      )
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 30);
  const safeStarted = Math.max(
    0,
    Math.min(9999999999999, Math.round(record.startedAt || Date.now()))
  );

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        id: safeId,
        name: safeName,
        targetDays: safeDays,
        currentPage: safePage,
        completedJuz: safeJuz,
        startedAtMs: safeStarted,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: safeName,
        targetDays: safeDays,
        currentPage: safePage,
        completedJuz: safeJuz,
        startedAtMs: safeStarted,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudPersonalKhatmah(
  uid: string,
  khatmahId: string
): Promise<void> {
  const safeId = khatmahId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safeId) return;
  const path = `users/${uid}/khatmahs/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'khatmahs', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== HIFZ QUIZ ACHIEVEMENT RECORD ====================

export async function loadUserHifzStats(
  uid: string
): Promise<HifzQuizAchievementRecord | null> {
  const path = `users/${uid}/sync/hifz`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'sync', 'hifz'));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const updatedTs = data.updatedAt as { toMillis?: () => number } | undefined;
    const rawSurahs = Array.isArray(data.testedSurahs) ? data.testedSurahs : [];
    const rawJuzs = Array.isArray(data.testedJuzs) ? data.testedJuzs : [];

    return {
      totalPoints: Math.max(0, Number(data.totalPoints || 0)),
      quizzesCompleted: Math.max(0, Number(data.quizzesCompleted || 0)),
      totalQuestionsAnswered: Math.max(
        0,
        Number(data.totalQuestionsAnswered || 0)
      ),
      totalCorrect: Math.max(0, Number(data.totalCorrect || 0)),
      bestScorePct: Math.max(0, Math.min(100, Number(data.bestScorePct || 0))),
      bestStreak: Math.max(0, Number(data.bestStreak || 0)),
      testedSurahs: Array.from(
        new Set(
          rawSurahs
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)
        )
      )
        .sort((a, b) => a - b)
        .slice(0, 114),
      testedJuzs: Array.from(
        new Set(
          rawJuzs
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
        )
      )
        .sort((a, b) => a - b)
        .slice(0, 30),
      lastTestedLabel:
        typeof data.lastTestedLabel === 'string' ? data.lastTestedLabel : '',
      updatedAt:
        typeof updatedTs?.toMillis === 'function'
          ? updatedTs.toMillis()
          : Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserHifzStats(
  uid: string,
  record: HifzQuizAchievementRecord
): Promise<void> {
  const path = `users/${uid}/sync/hifz`;
  const ref = doc(db, 'users', uid, 'sync', 'hifz');

  const safeSurahs = Array.from(
    new Set(
      (record.testedSurahs || []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= 114
      )
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 114);

  const safeJuzs = Array.from(
    new Set(
      (record.testedJuzs || []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= 30
      )
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 30);

  const mutablePayload = {
    totalPoints: Math.max(
      0,
      Math.min(2000000, Math.round(record.totalPoints || 0))
    ),
    quizzesCompleted: Math.max(
      0,
      Math.min(100000, Math.round(record.quizzesCompleted || 0))
    ),
    totalQuestionsAnswered: Math.max(
      0,
      Math.min(1000000, Math.round(record.totalQuestionsAnswered || 0))
    ),
    totalCorrect: Math.max(
      0,
      Math.min(1000000, Math.round(record.totalCorrect || 0))
    ),
    bestScorePct: Math.max(
      0,
      Math.min(100, Math.round(record.bestScorePct || 0))
    ),
    bestStreak: Math.max(
      0,
      Math.min(1000, Math.round(record.bestStreak || 0))
    ),
    testedSurahs: safeSurahs,
    testedJuzs: safeJuzs,
    lastTestedLabel: (record.lastTestedLabel || '').slice(0, 120),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, ...mutablePayload });
    } else {
      await updateDoc(ref, mutablePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}



