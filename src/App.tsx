import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  Dumbbell, 
  Calendar, 
  User, 
  Activity, 
  LogOut, 
  ChevronRight, 
  CheckCircle2, 
  Circle,
  TrendingUp,
  Scale,
  Ruler,
  AlertCircle,
  Flame,
  Menu,
  X,
  Utensils,
  Zap,
  Coffee,
  Apple
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyBZuZ9ztJp58kDsHMTZ-1f0ReqNV2FXypo",
  authDomain: "fitpro-planner.firebaseapp.com",
  projectId: "fitpro-planner",
  storageBucket: "fitpro-planner.firebasestorage.app",
  messagingSenderId: "1023274795392",
  appId: "1:1023274795392:web:4a88c84a075c1f21fec165"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'fitpro-app'; // Pode manter esse nome fixo

// --- UTILITÁRIOS E CONSTANTES ---

const GOALS = {
  HYPERTROPHY: { label: 'Hipertrofia', icon: Dumbbell, color: 'text-purple-600', bg: 'bg-purple-100' },
  WEIGHT_LOSS: { label: 'Emagrecimento', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100' },
  ENDURANCE: { label: 'Condicionamento', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' },
};

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Algoritmo simples de geração de treino
const generateTrainingPlan = (goal, frequency, sex) => {
  let split = 'FULL_BODY';
  if (frequency >= 4) split = 'UPPER_LOWER';
  if (frequency >= 5) split = 'ABC';

  // Base de exercícios
  const exercises = {
    chest: ['Supino Reto', 'Flexão de Braço', 'Crucifixo', 'Supino Inclinado'],
    back: ['Puxada Alta', 'Remada Curvada', 'Barra Fixa', 'Remada Baixa'],
    legs: ['Agachamento Livre', 'Leg Press', 'Cadeira Extensora', 'Stiff', 'Panturrilha'],
    shoulders: ['Desenvolvimento', 'Elevação Lateral', 'Elevação Frontal'],
    arms: ['Rosca Direta', 'Tríceps Pulley', 'Rosca Martelo', 'Tríceps Testa'],
    cardio: ['Esteira (HIIT)', 'Bicicleta', 'Elíptico', 'Pular Corda'],
    core: ['Prancha', 'Abdominal Supra', 'Abdominal Infra']
  };

  const plan = [];

  // Lógica de distribuição (Simplificada para demo)
  if (split === 'FULL_BODY') {
    ['A', 'B', 'C'].slice(0, frequency).forEach((day, index) => {
      plan.push({
        id: `treino-${index}`,
        name: `Treino ${day} - Corpo Todo`,
        exercises: [
          { name: exercises.legs[index % 2], sets: 3, reps: '10-12' },
          { name: exercises.chest[index % 2], sets: 3, reps: '10-12' },
          { name: exercises.back[index % 2], sets: 3, reps: '10-12' },
          { name: exercises.shoulders[0], sets: 3, reps: '12-15' },
          { name: exercises.core[0], sets: 3, reps: 'Falha' },
        ]
      });
    });
  } else if (split === 'UPPER_LOWER') {
    const routines = [
      { type: 'Superiores', muscleGroups: ['chest', 'back', 'shoulders', 'arms'] },
      { type: 'Inferiores', muscleGroups: ['legs', 'core'] }
    ];
    for (let i = 0; i < frequency; i++) {
      const routine = routines[i % 2];
      const dailyExercises = [];
      routine.muscleGroups.forEach(group => {
        dailyExercises.push({ name: exercises[group][0], sets: 3, reps: '10-12' });
        if(exercises[group][1]) dailyExercises.push({ name: exercises[group][1], sets: 3, reps: '12-15' });
      });
      plan.push({
        id: `treino-${i}`,
        name: `Treino ${String.fromCharCode(65+i)} - ${routine.type}`,
        exercises: dailyExercises
      });
    }
  } else {
    // ABC Split logic
    const routines = [
      { name: 'Peito e Tríceps', groups: ['chest', 'arms'] },
      { name: 'Costas e Bíceps', groups: ['back', 'arms'] },
      { name: 'Pernas e Ombros', groups: ['legs', 'shoulders'] }
    ];
    for(let i=0; i<frequency; i++) {
        const r = routines[i % 3];
        plan.push({
            id: `treino-${i}`,
            name: `Treino ${String.fromCharCode(65+i)} - ${r.name}`,
            exercises: [
                { name: exercises[r.groups[0]][0], sets: 4, reps: '8-10' },
                { name: exercises[r.groups[0]][1], sets: 3, reps: '10-12' },
                { name: exercises[r.groups[1]][0], sets: 4, reps: '8-10' },
                { name: exercises[r.groups[1]][1], sets: 3, reps: '12-15' },
                { name: exercises.core[0], sets: 3, reps: '20' }
            ]
        });
    }
  }

  // Ajuste para emagrecimento (mais reps, menos descanso hipotético) ou cardio extra
  if (goal === 'WEIGHT_LOSS') {
    plan.forEach(day => {
      day.exercises.push({ name: 'Cardio Final', sets: 1, reps: '20-30 min' });
    });
  }

  return plan;
};

// Algoritmo de Nutrição
const generateNutritionPlan = (profile) => {
  const { weight, height, age, sex, goal } = profile;
  
  // Cálculo TMB (Mifflin-St Jeor)
  let tmb = (10 * weight) + (6.25 * height) - (5 * age);
  tmb += (sex === 'male' ? 5 : -161);
  
  // Fator de Atividade (Considerando Moderado devido aos treinos)
  let tdee = Math.round(tmb * 1.55);
  
  let targetCalories = tdee;
  let macros = { p: 0, c: 0, f: 0 }; // Percentagens
  let suggestionTitle = "";

  if (goal === 'WEIGHT_LOSS') {
    targetCalories -= 500;
    macros = { p: 40, c: 30, f: 30 }; // Low carb relativo, high protein
    suggestionTitle = "Déficit Calórico & Proteínas";
  } else if (goal === 'HYPERTROPHY') {
    targetCalories += 300;
    macros = { p: 30, c: 50, f: 20 }; // High carb para energia
    suggestionTitle = "Superávit Calórico Limpo";
  } else {
    macros = { p: 30, c: 40, f: 30 }; // Manutenção
    suggestionTitle = "Manutenção & Performance";
  }

  // Refeições Sugeridas (Simplificado)
  const meals = [
    {
      time: 'Café da Manhã',
      icon: Coffee,
      options: goal === 'HYPERTROPHY' 
        ? ['Ovos mexidos com pão integral', 'Vitamina de banana com aveia e whey']
        : ['Iogurte natural com frutas vermelhas', 'Omelete de claras com espinafre']
    },
    {
      time: 'Almoço',
      icon: Utensils,
      options: ['Peito de frango grelhado', 'Arroz integral ou Batata doce', 'Salada verde à vontade', 'Legumes no vapor']
    },
    {
      time: 'Lanche da Tarde',
      icon: Apple,
      options: goal === 'HYPERTROPHY'
        ? ['Sanduíche de atum e queijo cottage', 'Barra de proteína + Fruta']
        : ['Mix de castanhas (30g)', 'Maçã ou Pera']
    },
    {
      time: 'Jantar',
      icon: Utensils,
      options: ['Filé de peixe ou Patinho moído', 'Mix de vegetais refogados', 'Azeite de oliva extra virgem']
    }
  ];

  return { targetCalories, macros, suggestionTitle, meals };
};


// --- COMPONENTES ---

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

const AuthScreen = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(userCredential.user, { displayName: name });
        } catch (innerError) {
          if (innerError.code === 'auth/operation-not-allowed') {
            console.warn("Email/Pass auth disabled. Falling back to anonymous.");
            let currentUser = auth.currentUser;
            if (!currentUser) {
              const anonCred = await signInAnonymously(auth);
              currentUser = anonCred.user;
            }
            await updateProfile(currentUser, { displayName: name });
          } else {
            throw innerError;
          }
        }
      } else {
        try {
           await signInWithEmailAndPassword(auth, email, password);
        } catch (innerError) {
           if (innerError.code === 'auth/operation-not-allowed') {
             console.warn("Email/Pass auth disabled. Falling back to anonymous.");
             if (!auth.currentUser) await signInAnonymously(auth);
           } else {
             throw innerError;
           }
        }
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError('Credenciais inválidas.');
      else if (err.code === 'auth/email-already-in-use') setError('E-mail já cadastrado.');
      else if (err.code === 'auth/weak-password') setError('A senha deve ter pelo menos 6 caracteres.');
      else setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">FitPro Planner</h1>
          <p className="text-gray-500 mt-2">Sua jornada fitness começa aqui.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center"
          >
            {loading ? <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"/> : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-2 text-indigo-600 font-medium hover:underline focus:outline-none"
            >
              {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const OnboardingForm = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    sex: 'male',
    age: '',
    weight: '',
    height: '',
    goal: 'HYPERTROPHY',
    frequency: 3,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const plan = generateTrainingPlan(formData.goal, parseInt(formData.frequency), formData.sex);
      const profileData = {
        ...formData,
        createdAt: serverTimestamp(),
        trainingPlan: plan,
        active: true,
      };

      const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
      await setDoc(userRef, profileData);
      onComplete(profileData);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Erro ao salvar perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Vamos conhecer você</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setFormData({...formData, sex: 'male'})}
                className={`p-4 rounded-xl border-2 flex flex-col items-center ${formData.sex === 'male' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="bg-blue-100 p-2 rounded-full mb-2"><User className="w-6 h-6 text-blue-600"/></div>
                <span className="font-medium">Masculino</span>
              </button>
              <button 
                onClick={() => setFormData({...formData, sex: 'female'})}
                className={`p-4 rounded-xl border-2 flex flex-col items-center ${formData.sex === 'female' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="bg-pink-100 p-2 rounded-full mb-2"><User className="w-6 h-6 text-pink-600"/></div>
                <span className="font-medium">Feminino</span>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
              <input 
                type="number" 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: e.target.value})}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: 25"
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Medidas Corporais</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    type="number" 
                    value={formData.weight} 
                    onChange={e => setFormData({...formData, weight: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                    placeholder="70.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    type="number" 
                    value={formData.height} 
                    onChange={e => setFormData({...formData, height: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                    placeholder="175"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Frequência de Treino Semanal</label>
              <input 
                type="range" 
                min="1" 
                max="7" 
                value={formData.frequency} 
                onChange={e => setFormData({...formData, frequency: e.target.value})}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="text-center mt-2 font-semibold text-indigo-600">{formData.frequency} dias por semana</div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Qual seu objetivo principal?</h2>
            <div className="space-y-3">
              {Object.entries(GOALS).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setFormData({...formData, goal: key})}
                  className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                    formData.goal === key 
                    ? `border-${value.color.split('-')[1]}-500 bg-${value.color.split('-')[1]}-50` 
                    : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-4 ${value.bg}`}>
                      <value.icon className={`w-6 h-6 ${value.color}`} />
                    </div>
                    <span className={`font-semibold ${formData.goal === key ? 'text-gray-900' : 'text-gray-600'}`}>{value.label}</span>
                  </div>
                  {formData.goal === key && <CheckCircle2 className="w-6 h-6 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Configuração do Perfil</h1>
          <p className="opacity-80 text-sm mt-1">Passo {step} de 3</p>
        </div>
        
        <div className="p-8">
          {renderStep()}

          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button 
                onClick={() => setStep(step - 1)}
                className="text-gray-500 font-medium px-4 py-2 hover:bg-gray-100 rounded-lg"
              >
                Voltar
              </button>
            ) : <div></div>}
            
            <button
              onClick={() => step < 3 ? setStep(step + 1) : handleSave()}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center shadow-lg shadow-indigo-200"
            >
              {loading ? 'Gerando Plano...' : (step === 3 ? 'Finalizar e Gerar Treino' : 'Próximo')}
              {!loading && step < 3 && <ChevronRight className="w-4 h-4 ml-2" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user, profile, onLogout }) => {
  const [completedToday, setCompletedToday] = useState({});
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'week'
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Memoriza o plano nutricional para evitar recálculos
  const nutrition = useMemo(() => generateNutritionPlan(profile), [profile]);

  const todayIndex = new Date().getDay(); 
  const dayName = WEEKDAYS[todayIndex];
  
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const workoutIndex = dayOfYear % profile.trainingPlan.length;
  const todaysWorkout = profile.trainingPlan[workoutIndex];

  const toggleExercise = (exerciseName) => {
    setCompletedToday(prev => ({
      ...prev,
      [exerciseName]: !prev[exerciseName]
    }));
  };

  const calculateProgress = () => {
    const total = todaysWorkout.exercises.length;
    const done = Object.values(completedToday).filter(Boolean).length;
    return Math.round((done / total) * 100);
  };

  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="bg-indigo-600 rounded-lg p-2 mr-3">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800 hidden sm:block">FitPro Planner</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Olá, {user.displayName || 'Atleta'}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
               <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center">
                 <CheckCircle2 className="w-4 h-4 mr-1"/> Conta Ativa
               </span>
               <button onClick={onLogout} className="text-gray-500 hover:text-red-600 transition-colors">
                 <LogOut className="w-6 h-6" />
               </button>
            </div>

            <button className="md:hidden p-2" onClick={() => setShowMobileMenu(!showMobileMenu)}>
              {showMobileMenu ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white border-t p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-700">{user.displayName}</div>
            <div className="text-xs text-gray-500 mb-2">{user.email}</div>
            <button onClick={onLogout} className="w-full text-left py-2 text-red-600 font-medium flex items-center">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Objetivo</p>
              <p className="text-lg font-bold text-gray-800">{GOALS[profile.goal]?.label}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-indigo-50 text-indigo-600 mr-4">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Frequência</p>
              <p className="text-lg font-bold text-gray-800">{profile.frequency}x / Semana</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center">
             <div className="p-3 rounded-full bg-orange-50 text-orange-600 mr-4">
              <Scale className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Peso Atual</p>
              <p className="text-lg font-bold text-gray-800">{profile.weight} kg</p>
            </div>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button 
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'today' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('today')}
          >
            Treino de Hoje
            {activeTab === 'today' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-lg"></div>}
          </button>
          <button 
            className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'week' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('week')}
          >
            Sua Rotina Completa
            {activeTab === 'week' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-lg"></div>}
          </button>
        </div>

        {activeTab === 'today' ? (
          <div className="space-y-8">
            {/* Training Card */}
            <div>
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden mb-6">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">{dayName}</h2>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                      {todaysWorkout.name}
                    </span>
                  </div>
                  <p className="text-indigo-100 mb-6">Foco de hoje: {profile.goal === 'WEIGHT_LOSS' ? 'Alta intensidade' : 'Força e Técnica'}</p>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 h-3 bg-black/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-500 ease-out" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="font-bold">{progress}%</span>
                  </div>
                </div>
                <Activity className="absolute right-0 bottom-0 w-48 h-48 text-white/10 -mr-8 -mb-8 transform rotate-12" />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-lg">Exercícios</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {todaysWorkout.exercises.map((ex, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 flex items-center justify-between transition-colors ${completedToday[ex.name] ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleExercise(ex.name)}
                    >
                      <div className="flex items-center space-x-4">
                        <button className={`transition-all duration-200 ${completedToday[ex.name] ? 'text-green-500' : 'text-gray-300 hover:text-indigo-500'}`}>
                          {completedToday[ex.name] ? <CheckCircle2 className="w-8 h-8" /> : <Circle className="w-8 h-8" />}
                        </button>
                        <div>
                          <p className={`font-semibold text-lg ${completedToday[ex.name] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{ex.name}</p>
                          <p className="text-sm text-gray-500">{ex.sets} séries x {ex.reps} reps</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {progress === 100 && (
                <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-medium animate-pulse mt-4">
                  🎉 Parabéns! Treino do dia concluído!
                </div>
              )}
            </div>

            {/* Nutrition Section */}
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Utensils className="w-6 h-6 mr-2 text-indigo-600" />
                Sugestões Alimentares
              </h3>

              {/* Macro Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Calorias</span>
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{nutrition.targetCalories}</p>
                  <p className="text-xs text-gray-500">Kcal/dia</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Proteína</span>
                    <Zap className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{nutrition.macros.p}%</p>
                  <p className="text-xs text-gray-500">da dieta</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Carbos</span>
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{nutrition.macros.c}%</p>
                  <p className="text-xs text-gray-500">da dieta</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Gorduras</span>
                    <Zap className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{nutrition.macros.f}%</p>
                  <p className="text-xs text-gray-500">da dieta</p>
                </div>
              </div>

              {/* Meal Plan */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                 <div className="mb-4">
                    <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      Estratégia: {nutrition.suggestionTitle}
                    </span>
                 </div>
                 <div className="space-y-6">
                    {nutrition.meals.map((meal, idx) => (
                      <div key={idx} className="flex items-start">
                        <div className="bg-gray-100 p-3 rounded-xl mr-4">
                           <meal.icon className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{meal.time}</h4>
                          <ul className="mt-1 space-y-1">
                            {meal.options.map((opt, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2"></div>
                                {opt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profile.trainingPlan.map((plan, idx) => (
              <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-800 text-lg">{plan.name}</h3>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">Treino {String.fromCharCode(65+idx)}</span>
                </div>
                <ul className="space-y-2">
                  {plan.exercises.map((ex, i) => (
                    <li key={i} className="text-sm text-gray-600 flex justify-between">
                      <span>{ex.name}</span>
                      <span className="text-gray-400">{ex.sets}x{ex.reps}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      // 1. Tentar Token Customizado (prioridade)
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          console.warn("Custom token failed, trying anonymous", e);
          // Falha no custom token, tentar anônimo
          try { await signInAnonymously(auth); } catch (err) { console.error("Anon auth failed", err); }
        }
      } else {
        // 2. Tentar Anônimo se não houver usuário
        if (!auth.currentUser) {
            try { await signInAnonymously(auth); } catch (err) { console.error("Anon auth failed", err); }
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch Profile
        try {
          // Rule 1: Accessing user specific data in /artifacts/{appId}/users/{uid}/profile/main
          const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'main');
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            setProfile(null); // Triggers onboarding
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  if (loading) return <LoadingScreen />;

  if (!user) return <AuthScreen />;

  if (!profile) return <OnboardingForm user={user} onComplete={(p) => setProfile(p)} />;

  return <Dashboard user={user} profile={profile} onLogout={handleLogout} />;
}