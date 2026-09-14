import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';

const C = {
  blue: '#2563EB', blueDark: '#1E40AF', blueSoft: '#EAF2FF',
  ink: '#17324D', muted: '#64748B', bg: '#F6F9FC', white: '#FFFFFF',
  border: '#DDE7F2', green: '#18A36B', greenSoft: '#E8F8F1',
  orange: '#F59E0B', orangeSoft: '#FFF6DF', red: '#DC5B5B',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SESSION_KEY = 'mindmate.mobile.sessions';
const PROFILE_KEY = 'mindmate.mobile.profile';
const SETTINGS_KEY = 'mindmate.mobile.settings';

const OBJECTS = [
  ['☕', 'Tea Cup', 'चाय का कप'], ['🍚', 'Rice Bowl', 'चावल का कटोरा'],
  ['☂️', 'Umbrella', 'छाता'], ['🧺', 'Basket', 'टोकरी'], ['🍎', 'Apple', 'सेब'],
  ['🔑', 'Key', 'चाबी'], ['📕', 'Book', 'किताब'], ['🕰️', 'Clock', 'घड़ी'],
  ['🧣', 'Shawl', 'शॉल'], ['🛠️', 'Farming Tool', 'खेती का औज़ार'],
  ['🌸', 'Flower', 'फूल'], ['🪔', 'Oil Lamp', 'दीया'],
];

const GAMES = [
  { id: 'memory', icon: '🧠', title: 'Memory Match', hi: 'याददाश्त खेल', desc: 'Remember the objects you see.' },
  { id: 'recall', icon: '👀', title: 'Object Recall', hi: 'वस्तु स्मरण', desc: 'Find the objects from the earlier set.' },
  { id: 'pattern', icon: '🔷', title: 'Pattern Recognition', hi: 'पैटर्न पहचान', desc: 'Choose what comes next.' },
  { id: 'attention', icon: '🎯', title: 'Attention Game', hi: 'ध्यान खेल', desc: 'Count the target objects carefully.' },
];

const copy = {
  en: {
    home: 'Home', games: 'Games', progress: 'Progress', assistant: 'Assistant', settings: 'Settings',
    goodMorning: 'Good morning', start: "Start Today's Training", today: "Today's Activities",
    score: 'Cognitive Training Score', streak: 'Day Streak', quick: 'Quick access',
    play: 'Play', back: 'Back', next: 'Next', submit: 'Submit', great: 'Great job!',
    accuracy: 'Accuracy', difficulty: 'Difficulty', level: 'Level', response: 'Response Time',
    read: 'Read aloud', reminders: 'Reminders', routine: 'Daily Routine', language: 'Language',
    font: 'Large text', contrast: 'High contrast', offline: 'Offline mode', sync: 'Sync now',
    caregiver: 'Caregiver Dashboard', logout: 'Log out', login: 'Sign in', email: 'Email', password: 'Password',
    role: 'Choose your role', elderly: 'Elderly', caregiverRole: 'Caregiver', admin: 'Admin',
  },
  hi: {
    home: 'मुख्य पृष्ठ', games: 'खेल', progress: 'प्रगति', assistant: 'सहायक', settings: 'सेटिंग्स',
    goodMorning: 'सुप्रभात', start: 'आज का प्रशिक्षण शुरू करें', today: 'आज की गतिविधियाँ',
    score: 'संज्ञानात्मक प्रशिक्षण स्कोर', streak: 'दिन की लगातार अभ्यास', quick: 'त्वरित पहुँच',
    play: 'खेलें', back: 'वापस', next: 'अगला', submit: 'जमा करें', great: 'बहुत अच्छा!',
    accuracy: 'सटीकता', difficulty: 'कठिनाई', level: 'स्तर', response: 'प्रतिक्रिया समय',
    read: 'आवाज़ में पढ़ें', reminders: 'अनुस्मारक', routine: 'दैनिक दिनचर्या', language: 'भाषा',
    font: 'बड़ा टेक्स्ट', contrast: 'उच्च कंट्रास्ट', offline: 'ऑफ़लाइन मोड', sync: 'अभी सिंक करें',
    caregiver: 'देखभालकर्ता डैशबोर्ड', logout: 'लॉग आउट', login: 'साइन इन', email: 'ईमेल', password: 'पासवर्ड',
    role: 'अपनी भूमिका चुनें', elderly: 'वरिष्ठ', caregiverRole: 'देखभालकर्ता', admin: 'व्यवस्थापक',
  },
};

function t(lang, key) { return copy[lang][key] || copy.en[key] || key; }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function pick(n) { return shuffle(OBJECTS).slice(0, n); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function adaptive(level, accuracy, recent) {
  const recentAvg = [...recent, accuracy].slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, recent.length + 1);
  if (accuracy >= 80 && recentAvg >= 75) return clamp(level + 1, 1, 4);
  if (accuracy < 50) return clamp(level - 1, 1, 4);
  return level;
}

async function api(path, options = {}) {
  if (!API_URL) throw new Error('offline');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default function App() {
  const [lang, setLang] = useState('en');
  const [settings, setSettings] = useState({ largeText: true, contrast: false });
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [screen, setScreen] = useState('login');
  const [selectedGame, setSelectedGame] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [recent, setRecent] = useState([]);
  const [level, setLevel] = useState(1);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(Boolean(API_URL));
  const [auth, setAuth] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, s, st] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY), AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (p) {
          const parsed = JSON.parse(p); setProfile(parsed); setRole(parsed.role); setScreen('home');
        }
        if (s) setSessions(JSON.parse(s));
        if (st) setSettings({ largeText: true, contrast: false, ...JSON.parse(st) });
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessions)); }, [sessions]);

  const score = useMemo(() => {
    if (!sessions.length) return 0;
    return Math.round(sessions.slice(-7).reduce((a, s) => a + s.score, 0) / Math.min(7, sessions.length));
  }, [sessions]);

  async function signIn(nextRole, email, password) {
    setLoading(true);
    let user = { id: `local-${nextRole}`, name: nextRole === 'elderly' ? 'Ramesh Baruah' : 'Caregiver Demo', role: nextRole, email };
    try {
      if (API_URL) {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        user = { ...data.user, token: data.token };
        setOnline(true);
      }
    } catch { setOnline(false); }
    setProfile(user); setRole(nextRole); await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    setScreen(nextRole === 'elderly' ? 'home' : 'caregiver'); setLoading(false);
  }

  async function logout() {
    await AsyncStorage.removeItem(PROFILE_KEY); setProfile(null); setRole(null); setScreen('login');
  }

  async function finishGame(result) {
    const accuracy = result.accuracy;
    const nextLevel = adaptive(level, accuracy, recent);
    const session = { id: Date.now().toString(), ...result, score: Math.round(accuracy), createdAt: new Date().toISOString(), level, nextLevel };
    setSessions(prev => [...prev, session]);
    setRecent(prev => [...prev, accuracy].slice(-3));
    setLevel(nextLevel); setLastResult({ ...session, changed: nextLevel !== level }); setScreen('result');
    try {
      if (API_URL && profile?.token) await api('/game-sessions', { method: 'POST', headers: { Authorization: `Bearer ${profile.token}` }, body: JSON.stringify(session) });
      setOnline(true);
    } catch { setOnline(false); }
  }

  async function sync() {
    if (!API_URL || !profile?.token) { Alert.alert('Offline', 'No backend URL is configured. Your local data is safe on this device.'); return; }
    try { await api('/game-sessions/sync', { method: 'POST', headers: { Authorization: `Bearer ${profile.token}` }, body: JSON.stringify({ sessions }) }); setOnline(true); Alert.alert('Synced', 'Your local sessions were synced.'); }
    catch { setOnline(false); Alert.alert('Offline', 'Could not reach the server. Try again later.'); }
  }

  function speak(text) { Speech.stop(); Speech.speak(text, { language: lang === 'hi' ? 'hi-IN' : 'en-IN', rate: 0.85 }); }

  if (loading) return <Splash />;
  if (screen === 'login') return <Login lang={lang} setLang={setLang} onLogin={signIn} />;

  const body = screen === 'home' ? <HomeScreen lang={lang} profile={profile} score={score} level={level} sessions={sessions} onStart={() => setScreen('games')} onNav={setScreen} speak={speak} />
    : screen === 'games' ? <GamesScreen lang={lang} onPick={(g) => { setSelectedGame(g); setScreen('play'); }} onNav={setScreen} />
    : screen === 'play' ? <GameScreen lang={lang} game={selectedGame} level={level} onBack={() => setScreen('games')} onFinish={finishGame} speak={speak} />
    : screen === 'result' ? <ResultScreen lang={lang} result={lastResult} onHome={() => setScreen('home')} onAgain={() => setScreen('play')} />
    : screen === 'progress' ? <ProgressScreen lang={lang} sessions={sessions} level={level} score={score} onNav={setScreen} />
    : screen === 'assistant' ? <AssistantScreen lang={lang} speak={speak} />
    : screen === 'settings' ? <SettingsScreen lang={lang} setLang={setLang} settings={settings} setSettings={setSettings} onLogout={logout} onNav={setScreen} />
    : <CaregiverScreen lang={lang} sessions={sessions} profile={profile} onNav={setScreen} />;

  return <SafeAreaView style={[styles.safe, settings.contrast && styles.highContrast]}>
    <StatusBar barStyle="dark-content" />
    {!online && <View style={styles.offline}><Text style={styles.offlineText}>● {t(lang, 'offline')} — sessions are saved locally</Text></View>}
    {body}
    <BottomNav lang={lang} screen={screen} onNav={setScreen} role={role} />
  </SafeAreaView>;
}

function Splash() { return <SafeAreaView style={styles.splash}><Text style={styles.logo}>🧠</Text><Text style={styles.brand}>MindMate AI</Text><Text style={styles.tag}>Train the Mind. Support the Memory.</Text><ActivityIndicator size="small" color={C.blue} style={{ marginTop: 24 }} /></SafeAreaView>; }

function Login({ lang, setLang, onLogin }) {
  const [role, setRole] = useState('elderly'); const [email, setEmail] = useState('ramesh.demo@mindmate.local'); const [password, setPassword] = useState('Demo@12345');
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
    <View style={styles.loginHero}><View style={styles.logoCircle}><Text style={{ fontSize: 42 }}>🧠</Text></View><Text style={styles.brand}>MindMate AI</Text><Text style={styles.tag}>Train the Mind. Support the Memory.</Text><View style={styles.pill}><Text style={styles.pillText}>SIH26003 • Cognitive Support</Text></View></View>
    <Card><Text style={styles.sectionTitle}>{t(lang, 'role')}</Text><View style={styles.roleRow}>{[['elderly','👴',t(lang,'elderly')],['caregiver','👩‍⚕️',t(lang,'caregiverRole')],['admin','🛡️',t(lang,'admin')]].map(([r,ic,tx]) => <Pressable key={r} onPress={() => { setRole(r); if(r==='elderly')setEmail('ramesh.demo@mindmate.local'); else if(r==='caregiver')setEmail('caregiver.demo@mindmate.local'); else setEmail('admin.demo@mindmate.local'); }} style={[styles.roleCard, role===r && styles.roleCardActive]}><Text style={{fontSize:26}}>{ic}</Text><Text style={styles.roleText}>{tx}</Text></Pressable>)}</View>
      <Text style={styles.label}>{t(lang,'email')}</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text style={styles.label}>{t(lang,'password')}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button title={t(lang,'login')} onPress={() => onLogin(role,email,password)} />
      <Pressable onPress={() => setLang(lang==='en'?'hi':'en')}><Text style={styles.link}>🌐 {lang==='en'?'हिन्दी में बदलें':'Switch to English'}</Text></Pressable>
    </Card>
    <Text style={styles.disclaimer}>MindMate provides cognitive training and memory assistance. It is not a medical diagnostic tool and does not replace professional medical advice.</Text>
  </ScrollView></SafeAreaView>;
}

function HomeScreen({lang,profile,score,level,sessions,onStart,onNav,speak}) {
  return <Page lang={lang} title={`${t(lang,'goodMorning')}, ${profile?.name?.split(' ')[0] || 'Ramesh'} 👋`} subtitle="A calm, simple daily routine for your mind." onNav={onNav}>
    <Card style={styles.heroCard}><View style={{flex:1}}><Text style={styles.heroEyebrow}>TODAY'S PLAN</Text><Text style={styles.heroTitle}>{t(lang,'start')}</Text><Text style={styles.heroText}>10–15 minutes • 4 gentle cognitive activities</Text><Button title={t(lang,'start')} onPress={onStart} /></View><Text style={styles.heroEmoji}>🧠</Text></Card>
    <Text style={styles.sectionTitle}>{t(lang,'quick')}</Text><View style={styles.statsRow}><Stat icon="🏆" value={`${score || 72}`} label={t(lang,'score')} /><Stat icon="🔥" value="5" label={t(lang,'streak')} /><Stat icon="⭐" value={`Lv ${level}`} label={t(lang,'level')} /></View>
    <Text style={styles.sectionTitle}>{t(lang,'today')}</Text><View style={styles.grid}>{GAMES.map(g => <Pressable key={g.id} style={styles.gameMini} onPress={() => {onNav('games')}}><Text style={{fontSize:30}}>{g.icon}</Text><Text style={styles.gameMiniTitle}>{lang==='hi'?g.hi:g.title}</Text><Text style={styles.gameMiniDesc}>{g.desc}</Text></Pressable>)}</View>
    <Card><Row label="Recent sessions" value={`${sessions.length}`} /><Row label="Current adaptive level" value={`Level ${level}`} /><Pressable onPress={() => speak(lang==='hi'?'आज का प्रशिक्षण शुरू करें':'Start today’s training')}><Text style={styles.link}>🔊 {t(lang,'read')}</Text></Pressable></Card>
  </Page>;
}

function GamesScreen({lang,onPick,onNav}) { return <Page lang={lang} title={t(lang,'games')} subtitle="Choose one activity. Take your time." onNav={onNav}><View style={styles.grid}>{GAMES.map(g => <Pressable key={g.id} style={styles.gameCard} onPress={() => onPick(g)}><Text style={styles.gameIcon}>{g.icon}</Text><Text style={styles.gameTitle}>{lang==='hi'?g.hi:g.title}</Text><Text style={styles.gameDesc}>{g.desc}</Text><View style={styles.playPill}><Text style={styles.playPillText}>{t(lang,'play')}  ›</Text></View></Pressable>)}</View><Card><Text style={styles.sectionTitle}>Adaptive difficulty</Text><Text style={styles.body}>MindMate adjusts the next level within a safe range based on recent accuracy. It never presents a diagnosis or medical claim.</Text></Card></Page>; }

function GameScreen({lang,game,level,onBack,onFinish,speak}) {
  const [items,setItems]=useState([]); const [shown,setShown]=useState([]); const [selected,setSelected]=useState([]); const [target,setTarget]=useState(null); const [answer,setAnswer]=useState(null); const [attentionCells,setAttentionCells]=useState([]); const [startedAt,setStartedAt]=useState(Date.now());
  const count = game?.id==='memory' || game?.id==='recall' ? ({1:4,2:6,3:8,4:10}[level]) : ({1:4,2:6,3:8,4:10}[level]);
  useEffect(() => { const p=pick(count); setItems(p); setSelected([]); setAnswer(null); setStartedAt(Date.now()); if(game?.id==='memory'){setShown(p); const tm=setTimeout(()=>setShown([]), Math.max(2800, 4400-level*350)); return ()=>clearTimeout(tm);} if(game?.id==='recall'){setShown(p); const tm=setTimeout(()=>setShown([]), Math.max(2500, 4000-level*300)); return ()=>clearTimeout(tm);} if(game?.id==='pattern'){setTarget(Math.floor(Math.random()*3));} if(game?.id==='attention'){const targetObj=p[Math.floor(Math.random()*p.length)]; const cells=Array.from({length:12},()=>Math.random()<0.3?targetObj:pick(1)[0]); setTarget(targetObj); setAttentionCells(cells);} }, [game,level]);
  if(!game) return null;
  const finish = (accuracy, response=Date.now()-startedAt) => onFinish({ game:game.id, accuracy:Math.round(accuracy), responseTime:Math.round(response/1000) });
  if(game.id==='memory') return <Page lang={lang} title={lang==='hi'?'याददाश्त खेल':'Memory Match'} subtitle="Memorize the objects before they disappear." onBack={onBack}><View style={styles.prompt}><Text style={styles.promptTitle}>👀 {lang==='hi'?'इन्हें याद करें':'Remember these objects'}</Text><Text style={styles.promptText}>{shown.length ? 'Look carefully…' : 'Now choose the objects you remember.'}</Text></View><View style={styles.objectGrid}>{(shown.length?shown:items).map((o,i)=><Pressable key={`${o[1]}-${i}`} onPress={()=>!shown.length&&setSelected(s=>s.includes(o[1])?s.filter(x=>x!==o[1]):[...s,o[1]])} style={[styles.objectCard,selected.includes(o[1])&&styles.objectSelected]}><Text style={{fontSize:38}}>{o[0]}</Text><Text style={styles.objectText}>{lang==='hi'?o[2]:o[1]}</Text></Pressable>)}</View>{!shown.length&&<Button title={t(lang,'submit')} onPress={()=>finish((selected.length/items.length)*100)} />}</Page>;
  if(game.id==='recall') return <Page lang={lang} title={lang==='hi'?'वस्तु स्मरण':'Object Recall'} subtitle="Select every object that was shown earlier." onBack={onBack}><View style={styles.objectGrid}>{items.map((o,i)=><Pressable key={`${o[1]}-${i}`} onPress={()=>setSelected(s=>s.includes(o[1])?s.filter(x=>x!==o[1]):[...s,o[1]])} style={[styles.objectCard,selected.includes(o[1])&&styles.objectSelected]}><Text style={{fontSize:38}}>{o[0]}</Text><Text style={styles.objectText}>{lang==='hi'?o[2]:o[1]}</Text></Pressable>)}</View><Button title={t(lang,'submit')} onPress={()=>finish((selected.length/items.length)*100)} /></Page>;
  if(game.id==='pattern') { const seq=['●','■','▲']; const correct=(target+1)%3; return <Page lang={lang} title={lang==='hi'?'पैटर्न पहचान':'Pattern Recognition'} subtitle={lang==='hi'?'आगे क्या आएगा?':'What comes next?'} onBack={onBack}><View style={styles.patternBox}><Text style={styles.patternText}>{seq[target]}  →  {seq[(target+1)%3]}  →  ?</Text></View><View style={styles.answerRow}>{seq.map((x,i)=><Pressable key={x} onPress={()=>setAnswer(i)} style={[styles.patternChoice,answer===i&&styles.objectSelected]}><Text style={{fontSize:44}}>{x}</Text></Pressable>)}</View><Button title={t(lang,'submit')} onPress={()=>finish(answer===null?0:(answer===correct?100:0))} /></Page>; }
  const actualCount = attentionCells.filter(o=>o?.[1]===target?.[1]).length; return <Page lang={lang} title={lang==='hi'?'ध्यान खेल':'Attention Game'} subtitle={lang==='hi'?'लक्ष्य वस्तु कितनी बार दिखी?':'How many times did you see the target?'} onBack={onBack}><View style={styles.prompt}><Text style={styles.promptTitle}>{target?.[0] || '🎯'} {lang==='hi'?'लक्ष्य':'Target'}</Text><Text style={styles.promptText}>{target ? (lang==='hi'?target[2]:target[1]) : ''}</Text></View><View style={styles.attentionGrid}>{attentionCells.map((o,i)=><View key={i} style={styles.attentionCell}><Text style={{fontSize:32}}>{o?.[0]}</Text></View>)}</View><View style={styles.answerRow}>{[0,1,2,3,4].map(n=><Pressable key={n} onPress={()=>setAnswer(n)} style={[styles.countChoice,answer===n&&styles.objectSelected]}><Text style={{fontSize:22,fontWeight:'900',color:C.ink}}>{n}</Text></Pressable>)}</View><Button title={t(lang,'submit')} onPress={()=>finish(answer===null?0:(answer===actualCount?100:0))} /></Page>;
}

function ResultScreen({lang,result,onHome,onAgain}) { if(!result)return null; return <Page lang={lang} title={t(lang,'great')} subtitle="Your activity has been saved on this device." onNav={onHome}><Card style={styles.resultHero}><Text style={{fontSize:58}}>🏆</Text><Text style={styles.resultScore}>{result.score}</Text><Text style={styles.resultLabel}>{t(lang,'score')}</Text></Card><View style={styles.statsRow}><Stat icon="🎯" value={`${result.accuracy}%`} label={t(lang,'accuracy')} /><Stat icon="⚡" value={`${result.responseTime}s`} label={t(lang,'response')} /><Stat icon="🧠" value={`Lv ${result.level}`} label={t(lang,'difficulty')} /></View><Card><Text style={styles.sectionTitle}>Adaptive engine</Text><Text style={styles.body}>{result.changed ? `Next activity will use Level ${result.nextLevel}.` : 'The next activity stays at the same comfortable level.'}</Text></Card><Button title={t(lang,'play')} onPress={onAgain} /><Button title={t(lang,'back')} variant="secondary" onPress={onHome} /></Page>; }

function ProgressScreen({lang,sessions,level,score,onNav}) { const recent=sessions.slice(-7); return <Page lang={lang} title={t(lang,'progress')} subtitle="A simple view of your practice history." onNav={onNav}><View style={styles.statsRow}><Stat icon="📈" value={`${score||72}`} label="Average score"/><Stat icon="🎮" value={`${sessions.length}`} label="Sessions"/><Stat icon="🧠" value={`Lv ${level}`} label="Current level"/></View><Card><Text style={styles.sectionTitle}>Recent performance</Text>{recent.length===0?<Text style={styles.body}>Complete a game to see your progress here.</Text>:recent.map((s,i)=><View key={s.id||i} style={styles.progressRow}><View style={{flex:1}}><Text style={styles.progressGame}>{s.game}</Text><Text style={styles.progressDate}>{new Date(s.createdAt).toLocaleDateString()}</Text></View><View style={styles.progressBar}><View style={[styles.progressFill,{width:`${clamp(s.score,5,100)}%`}]} /></View><Text style={styles.progressScore}>{s.score}</Text></View>)}</Card><Card><Text style={styles.sectionTitle}>Privacy & safety</Text><Text style={styles.body}>This screen reports training activity only. It does not diagnose dementia or measure disease progression.</Text></Card></Page>; }

function AssistantScreen({lang,speak}) { const [reminder,setReminder]=useState(false); async function addReminder(){ try{await Notifications.requestPermissionsAsync(); await Notifications.scheduleNotificationAsync({content:{title:'MindMate AI',body:lang==='hi'?'आज का मानसिक अभ्यास करने का समय है।':'It is time for today’s gentle cognitive practice.'},trigger:null});setReminder(true);}catch{Alert.alert('Notifications','Please allow notifications in Android settings.');} } return <Page lang={lang} title={t(lang,'assistant')} subtitle="Simple reminders and voice assistance." onNav={()=>{}}><Card style={styles.assistantHero}><Text style={{fontSize:48}}>🔔</Text><View style={{flex:1}}><Text style={styles.sectionTitle}>{t(lang,'reminders')}</Text><Text style={styles.body}>Morning practice • 10:00 AM</Text></View></Card><Button title={reminder?'Reminder sent ✓':'Send a reminder now'} onPress={addReminder}/><Card><Text style={styles.sectionTitle}>{t(lang,'routine')}</Text><Row label="Morning" value="Cognitive games"/><Row label="Afternoon" value="Hydration + rest"/><Row label="Evening" value="Memory recap"/></Card><Card><Text style={styles.sectionTitle}>Voice assistance</Text><Text style={styles.body}>Use voice read-out for instructions and reminders.</Text><Pressable onPress={()=>speak(lang==='hi'?'आज का अभ्यास शुरू करें':'Start today’s practice')}><Text style={styles.link}>🔊 {t(lang,'read')}</Text></Pressable></Card></Page>; }

function SettingsScreen({lang,setLang,settings,setSettings,onLogout,onNav}) { return <Page lang={lang} title={t(lang,'settings')} subtitle="Make the app comfortable for everyday use." onNav={onNav}><Card><Text style={styles.sectionTitle}>{t(lang,'language')}</Text><View style={styles.langRow}><Button title="English" variant={lang==='en'?'primary':'secondary'} onPress={()=>setLang('en')}/><Button title="हिन्दी" variant={lang==='hi'?'primary':'secondary'} onPress={()=>setLang('hi')}/></View><SettingRow label={t(lang,'font')} value={settings.largeText} onChange={v=>setSettings(s=>({...s,largeText:v}))}/><SettingRow label={t(lang,'contrast')} value={settings.contrast} onChange={v=>setSettings(s=>({...s,contrast:v}))}/></Card><Card><Text style={styles.sectionTitle}>About MindMate AI</Text><Text style={styles.body}>Train the Mind. Support the Memory.</Text><Text style={styles.body}>SIH26003 • Multilingual • Offline-first • Secure by design</Text></Card><Button title={t(lang,'logout')} variant="secondary" onPress={onLogout}/></Page>; }

function CaregiverScreen({lang,sessions,profile,onNav}) { const avg=sessions.length?Math.round(sessions.reduce((a,s)=>a+s.score,0)/sessions.length):72; return <Page lang={lang} title={t(lang,'caregiver')} subtitle={`Signed in as ${profile?.name||'Caregiver'}.`} onNav={onNav}><View style={styles.statsRow}><Stat icon="👤" value="1" label="Linked user"/><Stat icon="📊" value={`${avg}`} label="Average score"/><Stat icon="🔥" value="5" label="Streak"/></View><Card><Text style={styles.sectionTitle}>Ramesh Baruah</Text><Row label="Status" value="Active today"/><Row label="Current level" value="2"/><Row label="Last activity" value="Today"/></Card><Card><Text style={styles.sectionTitle}>What the caregiver can see</Text><Text style={styles.body}>Training sessions, scores, difficulty level and reminders. Avoid using these metrics as a medical diagnosis.</Text></Card></Page>; }

function Page({children,lang,title,subtitle,onNav,onBack}) { return <View style={styles.page}><View style={styles.top}><Pressable onPress={()=>onBack?onBack():onNav&&onNav('home')} style={styles.iconButton}><Text style={{fontSize:22}}>{onBack?'‹':'☰'}</Text></Pressable><View style={{flex:1}}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View><Text style={styles.topLogo}>🧠</Text></View><ScrollView contentContainerStyle={styles.scroll}>{children}<View style={{height:90}} /></ScrollView></View>; }

function BottomNav({lang,screen,onNav,role}) { const items=[['home','⌂',t(lang,'home')],['games','🧩',t(lang,'games')],['progress','📈',t(lang,'progress')],['assistant','🔔',t(lang,'assistant')],['settings','⚙️',t(lang,'settings')]]; if(role!=='elderly')items[2]=['caregiver','👥',t(lang,'caregiver')]; return <View style={styles.bottom}>{items.map(([id,ic,label])=><Pressable key={id} onPress={()=>onNav(id)} style={styles.navItem}><Text style={[styles.navIcon,screen===id&&{color:C.blue}]}>{ic}</Text><Text style={[styles.navText,screen===id&&{color:C.blue,fontWeight:'800'}]}>{label}</Text></Pressable>)}</View>; }
function Card({children,style}) { return <View style={[styles.card,style]}>{children}</View>; }
function Button({title,onPress,variant='primary'}) { return <Pressable onPress={onPress} style={[styles.button,variant==='secondary'&&styles.buttonSecondary]}><Text style={[styles.buttonText,variant==='secondary'&&styles.buttonSecondaryText]}>{title}</Text></Pressable>; }
function Stat({icon,value,label}) { return <View style={styles.stat}><Text style={{fontSize:22}}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Row({label,value}) { return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }
function SettingRow({label,value,onChange}) { return <View style={styles.settingRow}><Text style={styles.rowLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{true:C.blueSoft,false:'#CBD5E1'}} thumbColor={value?C.blue:'#94A3B8'} /></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg}, highContrast:{backgroundColor:'#FFFFFF'},
  splash:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'}, logo:{fontSize:64}, brand:{fontSize:32,fontWeight:'900',color:C.blue,marginTop:10}, tag:{fontSize:16,color:C.muted,marginTop:6},
  loginWrap:{padding:22,paddingTop:36,paddingBottom:40}, loginHero:{alignItems:'center',marginBottom:22}, logoCircle:{width:90,height:90,borderRadius:45,backgroundColor:C.blueSoft,alignItems:'center',justifyContent:'center',marginBottom:12}, pill:{backgroundColor:C.greenSoft,borderRadius:20,paddingHorizontal:14,paddingVertical:7,marginTop:12}, pillText:{color:C.green,fontWeight:'800',fontSize:12},
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:20,padding:18,marginBottom:16,shadowColor:'#1E3A5F',shadowOpacity:0.05,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2}, sectionTitle:{fontSize:18,fontWeight:'900',color:C.ink,marginBottom:10}, body:{fontSize:15,lineHeight:23,color:C.muted}, label:{fontSize:14,fontWeight:'800',color:C.ink,marginTop:12,marginBottom:6}, input:{height:52,borderWidth:1,borderColor:C.border,borderRadius:14,paddingHorizontal:14,fontSize:16,color:C.ink,backgroundColor:'#FAFCFF'},
  roleRow:{flexDirection:'row',gap:8,marginBottom:14}, roleCard:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:14,paddingVertical:12,alignItems:'center',backgroundColor:'#FBFDFF'}, roleCardActive:{borderColor:C.blue,backgroundColor:C.blueSoft}, roleText:{fontSize:12,fontWeight:'800',color:C.ink,marginTop:5}, link:{fontSize:15,fontWeight:'800',color:C.blue,marginTop:14}, disclaimer:{fontSize:12,lineHeight:18,color:C.muted,textAlign:'center',marginTop:14},
  button:{minHeight:52,borderRadius:15,backgroundColor:C.blue,alignItems:'center',justifyContent:'center',paddingHorizontal:18,marginTop:14}, buttonSecondary:{backgroundColor:C.blueSoft}, buttonText:{color:C.white,fontSize:16,fontWeight:'900'}, buttonSecondaryText:{color:C.blue},
  page:{flex:1}, top:{minHeight:80,flexDirection:'row',alignItems:'center',paddingHorizontal:18,paddingTop:8,gap:12,backgroundColor:C.bg}, iconButton:{width:42,height:42,borderRadius:14,backgroundColor:C.white,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'}, pageTitle:{fontSize:23,fontWeight:'900',color:C.ink}, pageSubtitle:{fontSize:13,color:C.muted,marginTop:2}, topLogo:{fontSize:26}, scroll:{padding:18},
  heroCard:{flexDirection:'row',backgroundColor:C.blue,padding:20,overflow:'hidden'}, heroEyebrow:{fontSize:11,fontWeight:'900',color:'#DDEAFF',letterSpacing:1}, heroTitle:{fontSize:24,fontWeight:'900',color:C.white,marginTop:5}, heroText:{fontSize:14,lineHeight:21,color:'#E8F1FF',marginTop:6}, heroEmoji:{fontSize:70,marginLeft:8,alignSelf:'center'},
  statsRow:{flexDirection:'row',gap:10,marginBottom:16}, stat:{flex:1,backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:17,padding:13,alignItems:'center'}, statValue:{fontSize:20,fontWeight:'900',color:C.ink,marginTop:3}, statLabel:{fontSize:11,color:C.muted,textAlign:'center',marginTop:2},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:16}, gameMini:{width:'47%',backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:18,padding:15,minHeight:145},gameMiniTitle:{fontSize:16,fontWeight:'900',color:C.ink,marginTop:8},gameMiniDesc:{fontSize:12,lineHeight:18,color:C.muted,marginTop:4},
  gameCard:{width:'47%',backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:20,padding:17,minHeight:190},gameIcon:{fontSize:42},gameTitle:{fontSize:18,fontWeight:'900',color:C.ink,marginTop:10},gameDesc:{fontSize:13,lineHeight:19,color:C.muted,marginTop:4},playPill:{alignSelf:'flex-start',backgroundColor:C.blueSoft,borderRadius:18,paddingHorizontal:12,paddingVertical:7,marginTop:12},playPillText:{color:C.blue,fontWeight:'900'},
  prompt:{backgroundColor:C.blueSoft,borderRadius:18,padding:18,marginBottom:16},promptTitle:{fontSize:20,fontWeight:'900',color:C.ink},promptText:{fontSize:14,color:C.muted,marginTop:5}, objectGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:14}, objectCard:{width:'31%',minHeight:110,borderWidth:1,borderColor:C.border,borderRadius:17,backgroundColor:C.white,alignItems:'center',justifyContent:'center',padding:8},objectSelected:{borderColor:C.blue,backgroundColor:C.blueSoft},objectText:{fontSize:12,fontWeight:'800',color:C.ink,textAlign:'center',marginTop:5},
  patternBox:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:20,padding:30,alignItems:'center',marginBottom:18},patternText:{fontSize:46,fontWeight:'900',color:C.blue},answerRow:{flexDirection:'row',gap:12,justifyContent:'center'},countChoice:{width:58,height:58,borderWidth:1,borderColor:C.border,borderRadius:16,backgroundColor:C.white,alignItems:'center',justifyContent:'center'}, patternChoice:{width:92,height:92,borderWidth:1,borderColor:C.border,borderRadius:20,backgroundColor:C.white,alignItems:'center',justifyContent:'center'}, attentionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:15},attentionCell:{width:'23%',aspectRatio:1,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},
  resultHero:{alignItems:'center',padding:28},resultScore:{fontSize:54,fontWeight:'900',color:C.blue,marginTop:4},resultLabel:{color:C.muted,fontWeight:'700'}, progressRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EEF3F8'},progressGame:{fontSize:14,fontWeight:'800',color:C.ink,textTransform:'capitalize'},progressDate:{fontSize:11,color:C.muted,marginTop:2},progressBar:{width:80,height:8,borderRadius:8,backgroundColor:'#E8EEF5',overflow:'hidden'},progressFill:{height:8,borderRadius:8,backgroundColor:C.blue},progressScore:{width:28,fontSize:14,fontWeight:'900',color:C.ink,textAlign:'right'},
  assistantHero:{flexDirection:'row',alignItems:'center',gap:15}, langRow:{flexDirection:'row',gap:10},settingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#EEF3F8'}, row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#EEF3F8'},rowLabel:{fontSize:15,color:C.muted},rowValue:{fontSize:15,fontWeight:'900',color:C.ink},
  bottom:{position:'absolute',left:0,right:0,bottom:0,height:78,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingBottom:4},navItem:{alignItems:'center',minWidth:55},navIcon:{fontSize:22,color:'#7A8EA5'},navText:{fontSize:10,color:'#7A8EA5',marginTop:3},offline:{backgroundColor:C.orangeSoft,paddingVertical:7,paddingHorizontal:12,alignItems:'center'},offlineText:{fontSize:12,fontWeight:'800',color:'#9A6A00'},
});
