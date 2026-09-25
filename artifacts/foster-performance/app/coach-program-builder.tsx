import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { RoleGate } from '@/components/RoleGate';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { AppButton } from '@/components/AppButton';
import { PageHeader, SectionCard, StatusPill } from '@/components/ProductUI';
import { radii, spacing, typography } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type BuilderExercise={id:string;name:string;sets:string;reps:string;equipment:string;muscle:string};
const CATEGORIES = [
  { label: 'Strength', trainingType: 'strength' },
  { label: 'Fitness', trainingType: 'fitness' },
  { label: 'Cardio', trainingType: 'running' },
  { label: 'Sport-Specific', trainingType: 'crosstraining' },
] as const;

const seed:BuilderExercise[]=[{id:'1',name:'Goblet Squat',sets:'3',reps:'10',equipment:'Dumbbell',muscle:'Quadriceps / Glutes'},{id:'2',name:'Push-Up',sets:'3',reps:'12',equipment:'Bodyweight',muscle:'Chest / Arms'}];
export default function CoachProgramBuilder(){
  const colors=useColors();const insets=useSafeAreaInsets();
  const { user } = useAuth();
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const [step,setStep]=useState(0);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [exercises,setExercises]=useState<BuilderExercise[]>(seed);
  const [status,setStatus]=useState<'Draft'|'Publishing'|'Published'>('Draft');
  const [category,setCategory]=useState<string>(CATEGORIES[0].label);
  const [weeks,setWeeks]=useState('8');
  const [daysPerWeek,setDaysPerWeek]=useState('3');
  const [programId,setProgramId]=useState<string|null>(editingId ?? null);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(!!editingId);

  // Opening with ?id= edits that program instead of starting a new one.
  const load = useCallback(async () => {
    if (!editingId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('workout_programs')
        .select('id, title, description, category, weeks, days_per_week, exercises, status')
        .eq('id', editingId).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        setProgramId(data.id);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setCategory(data.category ?? CATEGORIES[0].label);
        setWeeks(String(data.weeks ?? 8));
        setDaysPerWeek(String(data.days_per_week ?? 3));
        setStatus(data.status === 'published' ? 'Published' : 'Draft');
        const stored = Array.isArray(data.exercises) ? data.exercises : [];
        if (stored.length) {
          setExercises(stored.map((item: any, index: number) => ({
            id: item.id ?? String(index),
            name: item.name ?? '',
            sets: String(item.sets ?? ''),
            reps: String(item.reps ?? ''),
            equipment: Array.isArray(item.equipment) ? item.equipment.join(', ') : (item.equipment ?? ''),
            muscle: item.muscleGroup ?? item.muscle ?? '',
          })));
        }
      }
    } catch (error: any) {
      Alert.alert('Could not load program', error?.message ?? 'Please try again.');
    } finally { setLoading(false); }
  }, [editingId]);

  useEffect(() => { void load(); }, [load]);

  /** Writes the program and returns its id, so publish can reuse the same row. */
  const persist = useCallback(async (nextStatus: 'draft' | 'published'): Promise<string | null> => {
    if (!user) return null;
    if (!title.trim()) { Alert.alert('Title required', 'Give the program a title before saving.'); return null; }
    if (!exercises.length) { Alert.alert('Add an exercise', 'A program needs at least one exercise.'); return null; }
    setSaving(true);
    try {
      const selected = CATEGORIES.find((item) => item.label === category) ?? CATEGORIES[0];
      const payload = {
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        training_type: selected.trainingType,
        category: selected.label,
        level: 'Intermediate',
        weeks: Math.max(0, Number(weeks) || 0),
        days_per_week: Math.min(7, Math.max(1, Number(daysPerWeek) || 1)),
        duration_minutes: 45,
        equipment: Array.from(new Set(exercises.map((item) => item.equipment.trim()).filter(Boolean))),
        image_color: '#D6A84B',
        coach_tip: '',
        // Stored in the shape the member-facing screens already read.
        exercises: exercises.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          sets: Number(item.sets) || 1,
          reps: item.reps.trim(),
          rest: '60s',
          muscleGroup: item.muscle.trim(),
        })),
        status: nextStatus,
        ...(programId ? { id: programId } : {}),
      };
      const { data, error } = await supabase.from('workout_programs')
        .upsert(payload, { onConflict: 'id' }).select('id').single();
      if (error) throw new Error(error.message);
      setProgramId(data.id);
      return data.id;
    } catch (error: any) {
      Alert.alert('Could not save program', error?.message ?? 'Please try again.');
      return null;
    } finally { setSaving(false); }
  }, [category, daysPerWeek, description, exercises, programId, title, user, weeks]);
const update=(i:number,k:keyof BuilderExercise,v:string)=>setExercises(xs=>xs.map((x,n)=>n===i?{...x,[k]:v}:x));const add=()=>setExercises(xs=>[...xs,{id:Date.now().toString(),name:'New Exercise',sets:'3',reps:'10',equipment:'',muscle:''}]);return <RoleGate allow={['coach']}><View style={[styles.root,{backgroundColor:colors.background,paddingTop:Platform.OS==='web'?40:insets.top}]}><BackgroundLayer/><PageHeader title="Program Builder" subtitle={`Step ${step+1} of 3`} right={<StatusPill label={status} tone={status==='Published'?'success':'warning'}/>}/><View style={[styles.progress,{backgroundColor:colors.muted}]}><View style={{height:4,width:`${(step+1)/3*100}%`,backgroundColor:colors.accent}}/></View><ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+24}]} keyboardShouldPersistTaps="handled">{loading&&<ActivityIndicator color={colors.primary} style={{marginTop:32}}/>}{!loading&&step===0&&<><SectionCard title="Program details"><Text style={[styles.label,{color:colors.foreground}]}>Title</Text><TextInput value={title} onChangeText={setTitle} style={[styles.input,{color:colors.foreground,backgroundColor:colors.muted,borderColor:colors.border}]}/><Text style={[styles.label,{color:colors.foreground}]}>Description</Text><TextInput value={description} onChangeText={setDescription} multiline style={[styles.area,{color:colors.foreground,backgroundColor:colors.muted,borderColor:colors.border}]}/><View style={styles.chips}>{CATEGORIES.map((item)=><Pressable key={item.label} onPress={()=>setCategory(item.label)} accessibilityRole="radio" accessibilityState={{checked:category===item.label}} style={[styles.chip,{backgroundColor:category===item.label?colors.accent+'22':colors.muted,borderColor:category===item.label?colors.accent:colors.border}]}><Text style={{color:category===item.label?colors.accent:colors.mutedForeground}}>{item.label}</Text></Pressable>)}</View><View style={[styles.media,{backgroundColor:colors.muted}]}><MaterialCommunityIcons name="image-plus" size={28} color={colors.mutedForeground}/><Text style={{color:colors.mutedForeground}}>Add cover media placeholder</Text></View></SectionCard><SectionCard title="Structure"><View style={styles.row}><View style={{flex:1}}><Text style={[styles.label,{color:colors.foreground}]}>Weeks</Text><TextInput value={weeks} onChangeText={setWeeks} keyboardType="number-pad" style={[styles.input,{color:colors.foreground,backgroundColor:colors.muted,borderColor:colors.border}]}/></View><View style={{flex:1}}><Text style={[styles.label,{color:colors.foreground}]}>Days per week</Text><TextInput value={daysPerWeek} onChangeText={setDaysPerWeek} keyboardType="number-pad" style={[styles.input,{color:colors.foreground,backgroundColor:colors.muted,borderColor:colors.border}]}/></View></View><Text style={[styles.body,{color:colors.mutedForeground}]}>Use 0 weeks for an ongoing program.</Text></SectionCard></>}{!loading&&step===1&&<><SectionCard title="Week 1 · Day 1" subtitle="Drag/reorder controls are represented by the handle. Backend versioning remains pending.">{exercises.map((e,i)=><View key={e.id} style={[styles.exercise,{borderColor:colors.border}]}><Feather name="menu" size={20} color={colors.mutedForeground}/><View style={{flex:1,gap:8}}><TextInput value={e.name} onChangeText={v=>update(i,'name',v)} style={[styles.inline,{color:colors.foreground,borderColor:colors.border}]}/><View style={styles.row}><TextInput value={e.sets} onChangeText={v=>update(i,'sets',v)} placeholder="Sets" keyboardType="number-pad" style={[styles.smallInput,{color:colors.foreground,borderColor:colors.border}]}/><TextInput value={e.reps} onChangeText={v=>update(i,'reps',v)} placeholder="Reps" style={[styles.smallInput,{color:colors.foreground,borderColor:colors.border}]}/></View><TextInput value={e.equipment} onChangeText={v=>update(i,'equipment',v)} placeholder="Equipment" style={[styles.inline,{color:colors.foreground,borderColor:colors.border}]}/><TextInput value={e.muscle} onChangeText={v=>update(i,'muscle',v)} placeholder="Muscle group" style={[styles.inline,{color:colors.foreground,borderColor:colors.border}]}/></View><Pressable onPress={()=>setExercises(xs=>xs.filter((_,n)=>n!==i))} accessibilityRole="button" accessibilityLabel={`Remove ${e.name}`}><Feather name="trash-2" size={20} color={colors.destructive}/></Pressable></View>)}<AppButton label="Add Exercise" variant="secondary" icon="plus" onPress={add}/></SectionCard><SectionCard title="Additional content"><Text style={[styles.body,{color:colors.mutedForeground}]}>Add week · Add workout day · Instructions · Equipment · Media · Modules</Text></SectionCard></>}{!loading&&step===2&&<><SectionCard title="Member preview"><View style={[styles.preview,{backgroundColor:colors.muted}]}><Text style={[styles.previewEyebrow,{color:colors.accent}]}>COACH PROGRAM</Text><Text style={[styles.previewTitle,{color:colors.foreground}]}>{title||'Untitled program'}</Text><Text style={[styles.body,{color:colors.mutedForeground}]}>{description}</Text><Text style={[styles.body,{color:colors.foreground}]}>{exercises.length} exercises · 8 weeks · 3 days/week</Text></View>{exercises.map((e,i)=><Text key={e.id} style={[styles.body,{color:colors.foreground}]}>{i+1}. {e.name} · {e.sets}×{e.reps}</Text>)}</SectionCard><SectionCard title="Publish readiness"><StatusPill label={title&&exercises.length?'Ready to publish':'Validation issues'} tone={title&&exercises.length?'success':'danger'}/><Text style={[styles.body,{color:colors.mutedForeground}]}>Required: title, description, at least one workout day and exercise. Media is optional for this frontend preview.</Text></SectionCard><AppButton label={status==='Published'?'Unpublish':'Publish Program'} loading={saving} variant={status==='Published'?'secondary':'accent'} onPress={async()=>{const next=status==='Published'?'draft':'published';const saved=await persist(next);if(saved)setStatus(next==='published'?'Published':'Draft');}}/></>}<View style={styles.nav}><AppButton label="Back" variant="secondary" disabled={step===0} onPress={()=>setStep(s=>Math.max(0,s-1))} style={{flex:1}}/><AppButton label={step===2?'Save Draft':'Continue'} loading={saving} onPress={async()=>{if(step!==2){setStep(s=>s+1);return;}const saved=await persist('draft');if(saved){setStatus('Draft');Alert.alert('Draft saved','Your program is saved. Publish it when you are ready for members to see it.',[{text:'Done',onPress:()=>router.back()}]);}}} style={{flex:1}}/></View></ScrollView></View></RoleGate>}
const styles=StyleSheet.create({root:{flex:1},progress:{height:4},content:{padding:spacing.md,gap:spacing.md},label:{...typography.label},input:{height:52,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.md,...typography.body},area:{minHeight:100,borderWidth:1,borderRadius:radii.md,padding:spacing.md,textAlignVertical:'top',...typography.body},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{minHeight:40,borderWidth:1,borderRadius:radii.pill,paddingHorizontal:spacing.md,alignItems:'center',justifyContent:'center'},media:{minHeight:110,borderRadius:radii.md,alignItems:'center',justifyContent:'center',gap:6},body:{...typography.bodySmall},exercise:{flexDirection:'row',gap:spacing.sm,borderBottomWidth:1,paddingVertical:spacing.sm,alignItems:'flex-start'},inline:{minHeight:42,borderBottomWidth:1,...typography.bodySmall},row:{flexDirection:'row',gap:spacing.xs},smallInput:{flex:1,height:42,borderWidth:1,borderRadius:radii.sm,paddingHorizontal:spacing.sm},preview:{padding:spacing.lg,borderRadius:radii.lg,gap:spacing.sm},previewEyebrow:{...typography.caption,fontFamily:'Inter_700Bold'},previewTitle:{...typography.title},nav:{flexDirection:'row',gap:spacing.sm}});
