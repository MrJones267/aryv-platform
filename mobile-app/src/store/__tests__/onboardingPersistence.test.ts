/**
 * @fileoverview Onboarding is remembered across launches
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * The app slice was not persisted, so `isOnboarded` was false on every
 * launch and each sign-in went through role selection and the permissions
 * screen again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import appSlice, { appPersistConfig, setOnboarded, setOnboardingUserRole, setNetworkStatus } from '../slices/appSlice';

// The shared setup stubs redux-persist out; this is the one test about it.
jest.unmock('redux-persist');
const { persistReducer, persistStore } = jest.requireActual('redux-persist');

/** The app's store as far as onboarding goes, loaded from storage like a launch. */
const launch = async () => {
  const store = configureStore({
    reducer: combineReducers({ app: persistReducer(appPersistConfig, appSlice.reducer) }),
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
  const persistor = persistStore(store);
  // PersistGate waits for this before the app renders.
  await new Promise<void>((resolve) => {
    const check = () => (persistor.getState().bootstrapped ? resolve() : setTimeout(check, 5));
    check();
  });
  return { store, persistor };
};

describe('Onboarding persistence', () => {
  beforeEach(async () => {
    // The shared setup fakes timers; redux-persist schedules its writes on them.
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it('saves that onboarding is done and the role chosen, and nothing else', async () => {
    const { store, persistor } = await launch();
    store.dispatch(setOnboardingUserRole('driver'));
    store.dispatch(setOnboarded(true));
    store.dispatch(setNetworkStatus('offline'));
    await persistor.flush();

    const saved = JSON.parse((await AsyncStorage.getItem('persist:app')) as string);
    expect(JSON.parse(saved.isOnboarded)).toBe(true);
    expect(JSON.parse(saved.onboardingProgress)).toEqual(expect.objectContaining({ userRole: 'driver' }));
    expect(saved.networkStatus).toBeUndefined();
  });

  it('restores it on the next launch, so onboarding is not shown again', async () => {
    const first = await launch();
    first.store.dispatch(setOnboardingUserRole('courier'));
    first.store.dispatch(setOnboarded(true));
    await first.persistor.flush();
    first.persistor.pause();

    const next = await launch();
    expect(next.store.getState().app.isOnboarded).toBe(true);
    expect(next.store.getState().app.onboardingProgress.userRole).toBe('courier');
  });

  it('starts a fresh install not onboarded', async () => {
    const { store } = await launch();
    expect(store.getState().app.isOnboarded).toBe(false);
  });
});
