import { db, storage, auth } from '../firebase/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

export const uploadAudio = (fileOrBlob, filename, onProgress) => {
  return new Promise((resolve, reject) => {
    const user = auth.currentUser;
    if (!user) return reject(new Error('Unauthenticated'));

    const timestamp = Date.now();
    const storagePath = `recordings/${user.uid}/${timestamp}_${filename}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, fileOrBlob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadURL, storagePath });
      }
    );
  });
};

export const createRecording = async ({ filename, durationSeconds, mode, question }) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');

  const newDocRef = doc(collection(db, 'recordings'));
  await setDoc(newDocRef, {
    uid: user.uid,
    original_filename: filename,
    duration_seconds: durationSeconds || 0,
    has_report: false,
    recording_mode: mode || 'freestyle',
    interview_question: question || null,
    created_at: serverTimestamp()
  });

  return newDocRef.id;
};

export const getRecordings = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');

  // Firebase requires a composite index if combining where() and orderBy() on different fields.
  // To avoid manual index creation, we filter first and sort client-side.
  const q = query(
    collection(db, 'recordings'),
    where('uid', '==', user.uid)
  );

  const querySnapshot = await getDocs(q);
  const results = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Sort descending manually
  return results.sort((a, b) => {
    const tA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
    const tB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
    return tB - tA;
  });
};

export const deleteRecording = async (id) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');

  // get the recording first to get storage_path
  const recRef = doc(db, 'recordings', id);
  const recSnap = await getDoc(recRef);
  
  if (recSnap.exists()) {
    const data = recSnap.data();
    if (data.storage_path) {
      const fileRef = ref(storage, data.storage_path);
      try {
        await deleteObject(fileRef);
      } catch (err) {
        console.error('Failed to delete file from storage', err);
      }
    }
  }

  // Delete the report if exists
  const reportRef = doc(db, 'reports', id);
  try {
    await deleteDoc(reportRef);
  } catch (err) {
    console.error('Failed to delete report', err);
  }

  // Delete the recording doc
  await deleteDoc(recRef);
};

export const getReport = async (id) => {
  const reportRef = doc(db, 'reports', id);
  const reportSnap = await getDoc(reportRef);
  if (reportSnap.exists()) {
    const data = reportSnap.data();
    
    // Parse JSON string fields back to arrays
    const parseField = (field) => {
      try { return typeof field === 'string' ? JSON.parse(field) : (field || []); } 
      catch { return []; }
    };
    
    data.grammar_issues = parseField(data.grammar_issues);
    data.pronunciation_issues = parseField(data.pronunciation_issues);
    data.filler_words = parseField(data.filler_words);
    data.pauses = parseField(data.pauses);
    data.whisper_words = parseField(data.whisper_words);
    data.low_confidence_words = parseField(data.low_confidence_words);
    data.errors = parseField(data.errors);
    
    return data;
  }
  return null;
};
