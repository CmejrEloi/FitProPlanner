import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { AlertTriangle, Dumbbell, Zap, TrendingUp, User as UserIcon, LogOut, CheckCircle, Save, CalendarDays, BarChart3, Clock } from 'lucide-react';

// --- TYPE DEFINITIONS ---

// Define o tipo do usuário Firebase localmente. Usado para o usuário real e o mock.
interface FirebaseUser {
    uid: string;
    email: string | null;
}

type Goal = 'HYPERTROPHY' | 'WEIGHT_LOSS' | 'ENDURANCE';
type Frequency = '3' | '4' | '5' | '6';
type Sex = 'MALE' | 'FEMALE';
type BodyPart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio' | 'core';
type Page = 'login' | 'profile' | 'workout';

interface Exercise {
  name: string;
  sets: number;
  reps: string; // e.g., '8-12', '30 min', '10-15'
}

interface DailyWorkout {
  day: string; // e.g., 'Day 1'
  theme: string; // e.g., 'Push Day'
  exercises: Exercise[];
}

interface WorkoutPlan {
  goal: Goal;
  frequency: Frequency;
  dailyPlans: DailyWorkout[];
  generatedOn: number; // Timestamp
}

interface UserProfile {
  name: string;
  age: number;
  sex: Sex;
  goal: Goal;
  frequency: Frequency;
  weight: number;
  height: number;
}

interface ExerciseMap {
  chest: string[];
  back: string[];
  legs: string[];
  shoulders: string[];
  arms: string[];
  cardio: string[];
  core: string[];
  [key: string]: string[];
}

// --- CONSTANTS ---

const MOCK_USER_ID = "MOCK_USER_CANVAS_001";

const EXERCISES: ExerciseMap = {
  chest: ['Supino Reto (Barra)', 'Supino Inclinado (Halteres)', 'Crossover', 'Flexão'],
  back: ['Remada Curvada', 'Puxada Frontal', 'Levantamento Terra', 'Hiperextensão'],
  legs: ['Agachamento Livre', 'Leg Press', 'Extensora', 'Flexora'],
  shoulders: ['Desenvolvimento com Halteres', 'Elevação Lateral', 'Remada Alta', 'Face Pull'],
  arms: ['Rosca Direta', 'Tríceps Corda', 'Rosca Martelo', 'Tríceps Testa'],
  cardio: ['Corrida (Esteira)', 'Elíptico', 'Bicicleta', 'Burpees'],
  core: ['Prancha', 'Abdominal Infra', 'Rotação Russa', 'Elevação de Pernas'],
};

const GOAL_OPTIONS: Record<Goal, { label: string; icon: any; color: string; bg: string }> = {
  HYPERTROPHY: { label: 'Hipertrofia', icon: Dumbbell, color: 'text-orange-600', bg: 'bg-orange-100' },
  WEIGHT_LOSS: { label: 'Perda de Peso', icon: Zap, color: 'text-green-600', bg: 'bg-green-100' },
  ENDURANCE: { label: 'Resistência', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' },
};

// --- WORKOUT GENERATION LOGIC ---

function selectRandom<T>(arr: T[], count: number): T[] {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateDailyWorkout(dailyMuscleGroups: BodyPart[], goal: Goal): DailyWorkout {
  let dailyExercises: Exercise[] = [];
  let theme = dailyMuscleGroups.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' & ');

  for (const part of dailyMuscleGroups) {
    const availableExercises = EXERCISES[part];
    const numExercises = (part === 'cardio' || part === 'core') ? 1 : 3;

    const selectedNames = selectRandom(availableExercises, numExercises);

    selectedNames.forEach(exerciseName => {
      let sets = 3;
      let reps = '8-12';

      if (goal === 'WEIGHT_LOSS' || part === 'cardio') {
        sets = part === 'cardio' ? 1 : 4;
        reps = part === 'cardio' ? '30 min' : '12-15';
      } else if (goal === 'ENDURANCE') {
        sets = 5;
        reps = '15-20';
      }
      
      dailyExercises.push({ name: exerciseName, sets, reps });
    });
  }

  return {
    day: '',
    theme: theme || 'Descanso',
    exercises: dailyExercises,
  };
}

function generateWorkout(goal: Goal, frequency: Frequency): WorkoutPlan {
  const numDays = Number(frequency);
  const plan: DailyWorkout[] = [];

  // A common split logic based on frequency
  let splitSchedule: BodyPart[][] = [];

  switch (numDays) {
    case 3:
      splitSchedule = [
        ['legs', 'core'],
        ['chest', 'shoulders', 'arms'],
        ['back', 'core'],
        ['cardio']
      ];
      break;
    case 4:
      splitSchedule = [
        ['chest', 'shoulders'],
        ['back', 'arms'],
        ['legs', 'core'],
        ['cardio'],
        ['cardio']
      ];
      break;
    case 5:
      splitSchedule = [
        ['chest'],
        ['back'],
        ['legs'],
        ['shoulders', 'core'],
        ['arms', 'cardio']
      ];
      break;
    case 6:
      splitSchedule = [
        ['chest', 'shoulders'],
        ['back', 'core'],
        ['legs'],
        ['shoulders', 'arms'],
        ['back', 'legs', 'core'],
        ['cardio']
      ];
      break;
    default:
      splitSchedule = [];
  }

  for (let i = 0; i < numDays; i++) {
    let dayPlan = generateDailyWorkout(splitSchedule[i], goal);
    dayPlan.day = `Dia ${i + 1}`;
    plan.push(dayPlan);
  }

  if (numDays < 6) {
    plan.push({
      day: `Dia ${numDays + 1}`,
      theme: 'Descanso / Active Recovery',
      exercises: [{ name: 'Descanso Total', sets: 1, reps: '0' }],
    });
  }
  
  while (plan.length < numDays + 1) {
    plan.push({
      day: `Dia ${plan.length + 1}`,
      theme: 'Descanso Total',
      exercises: [{ name: 'Descanso Total', sets: 1, reps: '0' }],
    });
  }


  return {
    goal: goal,
    frequency: frequency,
    dailyPlans: plan.slice(0, numDays + 1),
    generatedOn: Date.now(),
  };
}

// --- FIREBASE INITIALIZATION AND AUTH (USANDO CONFIGURAÇÃO FIXA) ---

// Configuração Firebase fornecida pelo usuário
const APP_ID = 'fitpro-app';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZuZ9ztJp58kDsHMTZ-1f0ReqNV2FXypo",
  authDomain: "fitpro-planner.firebaseapp.com",
  projectId: "fitpro-planner",
  storageBucket: "fitpro-planner.firebasestorage.app",
  messagingSenderId: "1023274795392",
  appId: "1:1023274795392:web:4a88c84a075c1f21fec165"
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);


// Função para obter o caminho correto do documento de perfil
const getProfileDocRef = (userId: string) => {
  if (!db) throw new Error("Firestore not initialized.");
  // Private data path: /artifacts/{APP_ID}/users/{userId}/profile/data
  return doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'data');
};

// Função para obter o caminho correto do documento do plano de treino
const getWorkoutDocRef = (userId: string) => {
  if (!db) throw new Error("Firestore not initialized.");
  // Private data path: /artifacts/{APP_ID}/users/{userId}/workout/plan
  return doc(db, 'artifacts', APP_ID, 'users', userId, 'workout', 'plan');
};


// --- COMPONENTS ---

interface ProfileFormProps {
  user: FirebaseUser;
  profile: UserProfile | null;
  onComplete: (profile: UserProfile, plan: WorkoutPlan) => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ user, profile: initialProfile, onComplete }) => {
  const [formData, setFormData] = useState<UserProfile>(
    initialProfile || {
      name: '',
      age: 0,
      sex: 'MALE',
      goal: 'HYPERTROPHY',
      frequency: '3',
      weight: 0,
      height: 0,
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleGoalChange = (goal: Goal) => {
    setFormData(prev => ({ ...prev, goal }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.name === '' || formData.age <= 0 || formData.weight <= 0 || formData.height <= 0) {
      setError('Por favor, preencha todos os campos corretamente.');
      setLoading(false);
      return;
    }

    try {
      // 1. Generate Workout Plan
      const newPlan = generateWorkout(formData.goal, formData.frequency);

      // 2. Save Profile
      if (db) {
        const profileRef = getProfileDocRef(user.uid);
        await setDoc(profileRef, formData, { merge: false });

        // 3. Save Workout Plan
        const workoutRef = getWorkoutDocRef(user.uid);
        await setDoc(workoutRef, newPlan, { merge: false });
      }

      onComplete(formData, newPlan);
    } catch (innerError) {
      console.error('Erro ao salvar o perfil:', innerError);
      setError('Erro ao salvar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl rounded-xl">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 flex items-center">
        <UserIcon className="w-6 h-6 mr-3 text-indigo-600" />
        Seu Perfil Fitness
      </h2>
      <p className="mb-8 text-gray-600">Preencha os dados para gerar um plano de treino personalizado.</p>
      
      {user.uid === MOCK_USER_ID && (
        <div className="p-4 mb-4 bg-yellow-100 text-yellow-700 rounded-lg flex items-start">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Modo Simulado (Mock) Ativo:</span>
            <p className="text-sm">A autenticação Firebase falhou. Usando o ID de usuário simulado para que o app possa funcionar e salvar dados (somente neste ambiente).</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 mr-3" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <FormInput label="Nome" name="name" type="text" value={formData.name} onChange={handleInputChange} required />
          <FormInput label="Idade" name="age" type="number" value={formData.age === 0 ? '' : formData.age} onChange={handleInputChange} min={16} max={99} required />
          <FormInput label="Peso (kg)" name="weight" type="number" value={formData.weight === 0 ? '' : formData.weight} onChange={handleInputChange} min={30} max={250} required />
          <FormInput label="Altura (cm)" name="height" type="number" value={formData.height === 0 ? '' : formData.height} onChange={handleInputChange} min={100} max={250} required />
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <FormSelect label="Frequência Semanal (dias de treino)" name="frequency" value={formData.frequency} onChange={handleInputChange} options={[{ label: '3 Dias', value: '3' }, { label: '4 Dias', value: '4' }, { label: '5 Dias', value: '5' }, { label: '6 Dias', value: '6' }]} />
          <FormSelect label="Gênero" name="sex" value={formData.sex} onChange={handleInputChange} options={[{ label: 'Masculino', value: 'MALE' }, { label: 'Feminino', value: 'FEMALE' }]} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo Principal</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(GOAL_OPTIONS) as Goal[]).map((key: Goal) => {
              const option = GOAL_OPTIONS[key];
              const isSelected = formData.goal === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleGoalChange(key)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                    isSelected
                      ? `border-indigo-500 ${option.bg} shadow-md`
                      : 'border-gray-200 hover:border-indigo-300 bg-white'
                  }`}
                >
                  <option.icon className={`w-6 h-6 ${option.color}`} />
                  <span className={`font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Gerar e Salvar Plano
        </button>
      </form>
    </div>
  );
};

// Helper component for input fields
interface FormInputProps {
  label: string;
  name: string;
  type: 'text' | 'number';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  min?: number;
  max?: number;
}
const FormInput: React.FC<FormInputProps> = ({ label, name, type, value, onChange, required, min, max }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      min={min}
      max={max}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  </div>
);

// Helper component for select fields
interface FormSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string }[];
}
const FormSelect: React.FC<FormSelectProps> = ({ label, name, value, onChange, options }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

// Login Component (Simplificado, pois o fallback deve ser imediato)
const LoginScreen: React.FC<{ onSignIn: () => Promise<void>, error: string | null }> = ({ onSignIn, error }) => {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSignIn();
    } catch (innerError) {
      console.error('Login button failed:', innerError);
      // O App principal vai capturar o erro e atualizar a UI
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-2xl rounded-xl max-w-sm w-full text-center">
        <Dumbbell className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Fitness Planner</h1>
        <p className="text-gray-500 mb-8">Autenticação com Firebase</p>

        {error && (
          <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg flex items-center text-left text-sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span className="font-semibold">Erro de Autenticação:</span> {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
};


interface WorkoutViewProps {
  user: FirebaseUser;
  profile: UserProfile;
  plan: WorkoutPlan;
  onLogout: () => void;
  onGenerateNew: (profile: UserProfile, newPlan: WorkoutPlan) => void;
}

const WorkoutView: React.FC<WorkoutViewProps> = ({ user, profile, plan, onLogout, onGenerateNew }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const selectedDay = plan.dailyPlans[selectedDayIndex];

  const bmi = (profile.weight) / ((profile.height / 100) * (profile.height / 100));
  const formattedBmi = bmi.toFixed(1);

  const handleGenerateNew = async () => {
    if (!window.confirm('Tem certeza? Isso irá substituir seu plano de treino atual.')) {
        return;
    }
    setLoading(true);
    try {
        const newPlan = generateWorkout(profile.goal, profile.frequency);
        if (db) {
            const workoutRef = getWorkoutDocRef(user.uid);
            await setDoc(workoutRef, newPlan, { merge: false });
            onGenerateNew(profile, newPlan);
        }
    } catch (error) {
        console.error('Erro ao gerar novo plano:', error);
    } finally {
        setLoading(false);
    }
  }

  const handleLogoutClick = () => {
    // Se estiver no modo mock, apenas recarrega para limpar o estado
    if (user.uid === MOCK_USER_ID) {
      window.location.reload();
      return;
    }
    onLogout();
  }


  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-8 p-4 bg-white shadow-md rounded-xl">
        <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-gray-800">Seu Plano de Treino Personalizado</h1>
            <p className="text-sm text-gray-500">
                Olá, {profile.name}! Usuário ID: <span className="font-mono text-xs bg-gray-100 p-1 rounded">{user.uid}</span>
            </p>
            {user.uid === MOCK_USER_ID && (
                <p className="text-xs text-yellow-600 font-semibold mt-1">
                    (MODO SIMULADO - O logout apenas recarregará a página)
                </p>
            )}
        </div>
        <button
          onClick={handleLogoutClick}
          className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors flex items-center text-sm font-semibold"
        >
          <LogOut className="w-4 h-4 mr-1" /> Sair
        </button>
      </header>
      
      {/* Overview & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Objetivo" value={GOAL_OPTIONS[profile.goal].label} icon={GOAL_OPTIONS[profile.goal].icon} color={GOAL_OPTIONS[profile.goal].color} />
        <StatCard title="Frequência Semanal" value={`${profile.frequency} Dias`} icon={CalendarDays} color="text-indigo-600" />
        <StatCard title="IMC Calculado" value={formattedBmi} icon={BarChart3} color="text-teal-600" />
      </div>

      {/* Plan Navigation and Detail */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex flex-wrap border-b border-gray-200 mb-6">
          {plan.dailyPlans.map((dailyPlan, idx) => (
            <button
              key={dailyPlan.day}
              onClick={() => setSelectedDayIndex(idx)}
              className={`py-3 px-4 font-semibold transition-colors duration-200 border-b-4 ${
                idx === selectedDayIndex
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {dailyPlan.day}
            </button>
          ))}
        </div>

        {selectedDay && (
          <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Dumbbell className="w-5 h-5 mr-2 text-indigo-500" />
                    {selectedDay.theme}
                </h2>
                <button
                    onClick={handleGenerateNew}
                    disabled={loading}
                    className="bg-indigo-50 text-indigo-600 py-2 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Gerando...' : 'Gerar Novo Plano'}
                </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
                Gerado em: {new Date(plan.generatedOn).toLocaleDateString('pt-BR')}
            </p>

            <div className="space-y-4">
              {selectedDay.exercises.map((ex: Exercise, idx: number) => (
                <div key={idx} className="p-4 border border-gray-100 bg-white rounded-lg shadow-sm flex justify-between items-center">
                  <div className='flex items-center space-x-3'>
                    <span className="text-lg font-bold text-indigo-600 w-8">{idx + 1}.</span>
                    <span className="text-lg font-semibold text-gray-800">{ex.name}</span>
                  </div>
                  <div className="flex space-x-6 text-gray-600">
                    <div className="flex items-center bg-indigo-50 px-3 py-1 rounded-full text-sm font-medium">
                        <CheckCircle className="w-4 h-4 mr-1 text-indigo-500" />
                        {ex.sets} Sets
                    </div>
                    <div className="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">
                        <Clock className="w-4 h-4 mr-1 text-gray-500" />
                        {ex.reps} Reps
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// StatCard Component
interface StatCardProps {
    title: string;
    value: string;
    icon: any;
    color: string;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-indigo-600">
        <div className="flex items-center">
            <div className={`p-3 rounded-full ${color.replace('text-', 'bg-')}/20 mr-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    </div>
);


// --- MAIN APPLICATION COMPONENT ---

export default function App() {
  const [appInitialized, setAppInitialized] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [page, setPage] = useState<Page>('login');
  const [authError, setAuthError] = useState<string | null>(null); 

  const userId = user?.uid;

  // 1. Authentication and Initialization
  const handleAuth = useCallback(async () => {
    if (!auth || !db) {
        console.error("Firebase services not available.");
        setAppInitialized(true);
        return;
    }

    let authSucceeded = false;
    try {
        // Tentar autenticação real
        const initialAuthToken = (window as any).__initial_auth_token;
        
        // Tenta Login Anônimo primeiro
        try {
            await signInAnonymously(auth);
            authSucceeded = true;
        } catch (anonError) {
            // Se falhar, tentar o token customizado
            if (typeof initialAuthToken !== 'undefined') {
                await signInWithCustomToken(auth, initialAuthToken);
                authSucceeded = true;
            } else {
                // Se nenhum dos dois funcionar, lançar o erro
                throw anonError;
            }
        }
        setAuthError(null); 
        
    } catch (error) {
        // --- FALLBACK PARA MOCK AUTH ---
        const errorMessage = (error as any).code?.includes('auth/') 
          ? (error as any).code.replace('auth/', '').replace(/-/g, ' ').toUpperCase() 
          : 'ERRO DESCONHECIDO';
        
        console.warn(`Real Firebase Auth failed: ${errorMessage}. Falling back to MOCK AUTH.`);
        
        const mockUser: FirebaseUser = { uid: MOCK_USER_ID, email: 'mock@canvas.com' };
        setUser(mockUser);
        setAppInitialized(true);
        setAuthError(errorMessage);
        return; // Sai daqui para não esperar onAuthStateChanged
    }
    
    // Set up auth state listener (apenas para usuários reais, caso o try tenha sucesso)
    if (authSucceeded) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser as FirebaseUser); 
        } else {
          // Garante que o usuário mock não seja definido como nulo se for um logout real
          if (user?.uid !== MOCK_USER_ID) {
              setUser(null);
          }
          setProfile(null);
          setWorkoutPlan(null);
        }
        setAppInitialized(true);
      });
      return unsubscribe;
    }

  }, [user?.uid]);

  // 2. Data Loading (Profile and Workout Plan)
  useEffect(() => {
    if (!userId || !db) return;

    let unsubscribeProfile: () => void = () => {};
    let unsubscribeWorkout: () => void = () => {};
    
    // Se estiver no modo mock, não esperamos por onAuthStateChanged para buscar dados
    if (userId) {
        // Load Profile
        try {
            unsubscribeProfile = onSnapshot(getProfileDocRef(userId), (doc) => {
                if (doc.exists()) {
                    const data = doc.data() as UserProfile;
                    setProfile(data);
                } else {
                    setProfile(null);
                }
            });
        } catch (error) {
            console.error("Error subscribing to profile:", error);
        }

        // Load Workout Plan
        try {
            unsubscribeWorkout = onSnapshot(getWorkoutDocRef(userId), (doc) => {
                if (doc.exists()) {
                    const data = doc.data() as WorkoutPlan;
                    setWorkoutPlan(data);
                } else {
                    setWorkoutPlan(null);
                }
            });
        } catch (error) {
            console.error("Error subscribing to workout plan:", error);
        }
    }

    // Clean up listeners
    return () => {
        unsubscribeProfile();
        unsubscribeWorkout();
    };

  }, [userId]);


  // 3. Page Navigation Logic
  useEffect(() => {
    if (!appInitialized) return;
    
    if (user) {
      if (profile && workoutPlan) {
        setPage('workout');
      } else {
        setPage('profile');
      }
    } else {
      setPage('login');
    }
  }, [user, profile, workoutPlan, appInitialized]);

  // Handle Sign In (re-attempt real auth if failed)
  const handleSignIn = useCallback(async () => {
    // Tenta reautenticar (será tratado por handleAuth)
    await handleAuth();
  }, [handleAuth]);
  
  // Handle Logout (real firebase logout, or page reload for mock)
  const handleLogout = useCallback(() => {
    if (auth) {
      signOut(auth);
    }
    // O onAuthStateChanged deve limpar o usuário, mas forçamos o refresh para o mock
    if (user?.uid === MOCK_USER_ID) {
        window.location.reload();
    }
  }, [user?.uid]);

  // Handle form submission and plan update
  const handleProfileComplete = useCallback((newProfile: UserProfile, newPlan: WorkoutPlan) => {
      setProfile(newProfile);
      setWorkoutPlan(newPlan);
      setPage('workout');
  }, []);
  
  const handleGenerateNew = useCallback((newProfile: UserProfile, newPlan: WorkoutPlan) => {
      setProfile(newProfile);
      setWorkoutPlan(newPlan);
  }, []);


  // Run initial authentication setup
  useEffect(() => {
    handleAuth();
  }, [handleAuth]);


  // --- Render based on State/Page ---
  if (!appInitialized && !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-3 text-gray-700">Carregando autenticação...</span>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-gray-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {page === 'login' && <LoginScreen onSignIn={handleSignIn} error={authError} />}

      {page === 'profile' && user && (
        <div className='py-12 bg-gray-50'>
            <ProfileForm user={user} profile={profile} onComplete={handleProfileComplete} />
        </div>
      )}

      {page === 'workout' && user && profile && workoutPlan && (
        <WorkoutView user={user} profile={profile} plan={workoutPlan} onLogout={handleLogout} onGenerateNew={handleGenerateNew} />
      )}
    </div>
  );
}