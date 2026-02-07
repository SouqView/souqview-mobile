import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, MIN_TOUCH_TARGET, TYPO } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useStockComments } from '../../hooks/useStockComments';
import { useStockVote } from '../../hooks/useStockVote';
import type { CommentRow, CommentSentiment } from '../../services/commentsService';

export interface CommunityTabProps {
  symbol: string;
  /** Optional legacy posts from context (ignored when using Supabase) */
  posts?: unknown[];
}

/** Large "Tug of War" bar: [ 🐂 Bulls 60% | 🐻 Bears 40% ] from stock_votes */
function TugOfWarBar({
  bullPct,
  bearPct,
  myVote,
  onVoteBullish,
  onVoteBearish,
  loading,
}: {
  bullPct: number;
  bearPct: number;
  myVote: 'bullish' | 'bearish' | null;
  onVoteBullish: () => void;
  onVoteBearish: () => void;
  loading: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={tugStyles.wrap}>
      <View style={tugStyles.barLabels}>
        <Text style={tugStyles.bullLabel}>🐂 Bulls {bullPct}%</Text>
        <Text style={tugStyles.bearLabel}>🐻 Bears {bearPct}%</Text>
      </View>
      <View style={[tugStyles.track, { backgroundColor: colors.card }]}>
        <View style={[tugStyles.fillLeft, { width: `${bullPct}%` }]} />
        <View style={[tugStyles.fillRight, { width: `${bearPct}%` }]} />
      </View>
      <View style={tugStyles.buttons}>
        <TouchableOpacity
          style={[tugStyles.voteBtn, { borderColor: colors.positive, backgroundColor: colors.card }, myVote === 'bullish' && tugStyles.voteBtnActive]}
          onPress={onVoteBullish}
          disabled={loading}
        >
          <Text style={[tugStyles.voteBtnText, { color: colors.textSecondary }, myVote === 'bullish' && tugStyles.voteBtnTextActive]}>
            Vote Bullish
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tugStyles.voteBtn, { borderColor: colors.negative, backgroundColor: colors.card }, myVote === 'bearish' && tugStyles.voteBtnActiveBear]}
          onPress={onVoteBearish}
          disabled={loading}
        >
          <Text style={[tugStyles.voteBtnText, { color: colors.textSecondary }, myVote === 'bearish' && tugStyles.voteBtnTextActiveBear]}>
            Vote Bearish
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tugStyles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bullLabel: { fontSize: 15, fontWeight: '700', color: COLORS.positive, ...TYPO.tabular },
  bearLabel: { fontSize: 15, fontWeight: '700', color: COLORS.negative, ...TYPO.tabular },
  track: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fillLeft: {
    backgroundColor: COLORS.positive,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  fillRight: {
    backgroundColor: COLORS.negative,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 14 },
  voteBtn: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET * 1.2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  voteBull: {},
  voteBear: {},
  voteBtnActive: { backgroundColor: COLORS.neonMintDim },
  voteBtnActiveBear: { backgroundColor: COLORS.negativeDim },
  voteBtnText: { fontSize: 16, fontWeight: '700' },
  voteBtnTextActive: { color: COLORS.positive },
  voteBtnTextActiveBear: { color: COLORS.negative },
});

function CommentCard({
  comment,
  onReply,
  onUpvote,
  onDownvote,
  onReport,
  iconOnBadgeColor,
}: {
  comment: CommentRow;
  onReply: (id: string) => void;
  onUpvote: (id: string) => void;
  onDownvote: (id: string) => void;
  onReport: (id: string) => void;
  iconOnBadgeColor: string;
}) {
  const { colors } = useTheme();
  const [showActions, setShowActions] = useState(false);
  const author = comment.user_id
    ? `User ${comment.user_id.slice(0, 8)}`
    : 'Anonymous';
  const upvotes = comment.upvotes ?? 0;
  const downvotes = comment.downvotes ?? 0;

  const handleReport = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Report comment',
      'Report this comment as inappropriate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => onReport(comment.id),
        },
      ]
    );
    setShowActions(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.author, { color: colors.text }]}>{author}</Text>
        <View style={[styles.sentimentBadge, comment.sentiment === 'bullish' ? styles.bullishBadge : styles.bearishBadge]}>
          <Ionicons
            name={comment.sentiment === 'bullish' ? 'trending-up' : 'trending-down'}
            size={12}
            color={iconOnBadgeColor}
          />
          <Text style={[styles.sentimentText, { color: colors.text }]}>
            {comment.sentiment === 'bullish' ? 'Bullish' : 'Bearish'}
          </Text>
        </View>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{comment.text}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onReply(comment.id);
          }}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.actionLabel, { color: colors.textTertiary }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onUpvote(comment.id);
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-up-circle-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.actionLabel, styles.tabular, { color: colors.textTertiary }]}>{upvotes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDownvote(comment.id);
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-down-circle-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.actionLabel, styles.tabular, { color: colors.textTertiary }]}>{downvotes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowActions(!showActions)}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      {showActions && (
        <TouchableOpacity style={styles.reportBtn} onPress={handleReport}>
          <Ionicons name="flag-outline" size={16} color={colors.negative} />
          <Text style={[styles.reportLabel, { color: colors.negative }]}>Report</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.time, { color: colors.textTertiary }]}>
        {new Date(comment.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
}

export function CommunityTab({ symbol }: CommunityTabProps) {
  const { colors } = useTheme();
  const { comments, loading, posting, addComment, upvote, downvote, report } = useStockComments(symbol);
  const { bullPct, bearPct, myVote, setVote, loading: voteLoading } = useStockVote(symbol);
  const [inputText, setInputText] = useState('');
  const [sentiment, setSentiment] = useState<CommentSentiment>('bullish');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || posting) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addComment(text, sentiment, replyingTo ?? undefined);
    setInputText('');
    setReplyingTo(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { color: colors.text }]}>Community — {symbol}</Text>

        <TugOfWarBar
          bullPct={bullPct}
          bearPct={bearPct}
          myVote={myVote}
          onVoteBullish={() => setVote('bullish')}
          onVoteBearish={() => setVote('bearish')}
          loading={voteLoading}
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.electricBlue} />
            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading feed…</Text>
          </View>
        ) : comments.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No posts yet. Say something!</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id}>
              <CommentCard
                comment={c}
                onReply={setReplyingTo}
                onUpvote={upvote}
                onDownvote={downvote}
                onReport={report}
                iconOnBadgeColor={colors.text}
              />
              {(c.replies ?? []).map((r) => (
                <View key={r.id} style={styles.replyWrap}>
                  <CommentCard
                    comment={r}
                    onReply={setReplyingTo}
                    onUpvote={upvote}
                    onDownvote={downvote}
                    onReport={report}
                    iconOnBadgeColor={colors.text}
                  />
                </View>
              ))}
            </View>
          ))
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeAreaView style={[styles.inputSafe, { backgroundColor: colors.background, borderTopColor: colors.border }]} edges={['bottom']}>
        {replyingTo && (
          <View style={styles.replyingBar}>
            <Text style={[styles.replyingText, { color: colors.textTertiary }]}>Replying to comment</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }, sentiment === 'bullish' && styles.toggleBtnBull]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSentiment('bullish');
              }}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }, sentiment === 'bullish' && styles.toggleTextBull]}>
                🐂 Bullish
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }, sentiment === 'bearish' && styles.toggleBtnBear]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSentiment('bearish');
              }}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }, sentiment === 'bearish' && styles.toggleTextBear]}>
                🐻 Bearish
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Say something..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
              editable={!posting}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || posting) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || posting}
              hitSlop={8}
            >
              {posting ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="send" size={20} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  header: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  loadingWrap: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { fontSize: 13, color: COLORS.textTertiary, marginTop: 8 },
  empty: { fontSize: 15, color: COLORS.textSecondary, paddingVertical: 24 },
  bottomSpacer: { height: 80 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  author: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  sentimentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bullishBadge: { backgroundColor: COLORS.positive },
  bearishBadge: { backgroundColor: COLORS.negative },
  sentimentText: { fontSize: 11, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 13, color: COLORS.textTertiary },
  tabular: { ...TYPO.tabular },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
  },
  reportLabel: { fontSize: 13, color: COLORS.negative },
  time: { fontSize: 11, color: COLORS.textTertiary, marginTop: 8 },
  replyWrap: { marginLeft: 20, marginBottom: 8 },
  inputSafe: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  replyingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyingText: { fontSize: 12, color: COLORS.textTertiary },
  inputRow: { gap: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnBull: { backgroundColor: COLORS.neonMintDim, borderColor: COLORS.neonMint },
  toggleBtnBear: { backgroundColor: COLORS.negativeDim, borderColor: COLORS.negative },
  toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  toggleTextBull: { color: COLORS.neonMint },
  toggleTextBear: { color: COLORS.negative },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: COLORS.textTertiary, opacity: 0.7 },
});
