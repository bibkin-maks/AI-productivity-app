import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice';
import calendarReducer from '../slices/calendarSlice';
import authReducer from '../slices/authSlice';
import { api } from '../slices/apiSlice';

// ========================================================================
// Redux Store
// ========================================================================
export const store = configureStore({
    reducer: {
        auth: authReducer,
        chat: chatReducer,
        calendar: calendarReducer,
        [api.reducerPath]: api.reducer,
    },

    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }).concat(api.middleware),

    devTools: import.meta.env.DEV,
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Optional helpers
export const getState = () => store.getState();
export const dispatch = store.dispatch;

