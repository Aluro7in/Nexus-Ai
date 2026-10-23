import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import type {
  UserProfile,
  UserPreference,
  TaskItem,
  ConversationMessage,
  MemoryItem,
  CommerceOrder,
  WorkflowExecution,
} from '../types';

// 1. User Profile
export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userRef);
    const now = new Date().toISOString();

    if (!existing.exists()) {
      await setDoc(userRef, {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Google User',
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await updateDoc(userRef, {
        displayName: user.displayName || 'Google User',
        photoURL: user.photoURL || '',
        updatedAt: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 2. User Preferences
export async function getUserPreferences(userId: string): Promise<UserPreference | null> {
  const path = `user_preferences/${userId}`;
  try {
    const docRef = doc(db, 'user_preferences', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserPreference;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserPreferences(prefs: UserPreference): Promise<void> {
  const path = `user_preferences/${prefs.userId}`;
  try {
    const docRef = doc(db, 'user_preferences', prefs.userId);
    await setDoc(
      docRef,
      {
        ...prefs,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 3. Tasks
export async function fetchUserTasks(userId: string): Promise<TaskItem[]> {
  const path = 'tasks';
  try {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskItem, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveTaskToFirestore(task: TaskItem): Promise<void> {
  const path = `tasks/${task.id}`;
  try {
    const docRef = doc(db, 'tasks', task.id);
    await setDoc(docRef, task, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTaskFromFirestore(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    const docRef = doc(db, 'tasks', taskId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 4. Conversation Messages
export async function fetchUserMessages(userId: string): Promise<ConversationMessage[]> {
  const path = 'messages';
  try {
    const q = query(
      collection(db, 'messages'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConversationMessage, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveMessageToFirestore(msg: ConversationMessage, userId: string): Promise<void> {
  const path = `messages/${msg.id}`;
  try {
    const docRef = doc(db, 'messages', msg.id);
    await setDoc(docRef, { ...msg, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 5. Memories
export async function fetchUserMemories(userId: string): Promise<MemoryItem[]> {
  const path = 'memories';
  try {
    const q = query(
      collection(db, 'memories'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemoryItem, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveMemoryToFirestore(memory: MemoryItem): Promise<void> {
  const path = `memories/${memory.id}`;
  try {
    const docRef = doc(db, 'memories', memory.id);
    await setDoc(docRef, memory, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMemoryFromFirestore(memoryId: string): Promise<void> {
  const path = `memories/${memoryId}`;
  try {
    const docRef = doc(db, 'memories', memoryId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 6. Commerce Orders
export async function fetchUserOrders(userId: string): Promise<CommerceOrder[]> {
  const path = 'commerce_orders';
  try {
    const q = query(
      collection(db, 'commerce_orders'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommerceOrder, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveOrderToFirestore(order: CommerceOrder): Promise<void> {
  const path = `commerce_orders/${order.id}`;
  try {
    const docRef = doc(db, 'commerce_orders', order.id);
    await setDoc(docRef, order, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
