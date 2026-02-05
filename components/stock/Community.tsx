import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getRequest, postRequest } from '../../services/api';
import { useAuth } from '../../src/context/AuthContext';

interface CommunityProps {
  symbol?: string;
}

interface SentimentData {
  bullishPercent?: number;
  bearishPercent?: number;
  totalVotes?: number;
  userVote?: {
    voteType?: 'bullish' | 'bearish';
    canVoteAgain?: boolean;
    nextVoteTime?: string;
  };
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Community({ symbol = 'AAPL' }: CommunityProps) {
  const { user, isAuthenticated } = useAuth();
  const [voting, setVoting] = useState(false);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [userVote, setUserVote] = useState<SentimentData['userVote'] | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (symbol) {
      fetchSentiment();
    }
  }, [symbol]);

  const fetchSentiment = async () => {
    try {
      setLoading(true);
      const response = await getRequest(`/api/sentiment/${symbol}`);
      
      if (response?.data) {
        const data = response.data;
        setSentimentData(data);
        
        const userVoteData = data.userVote;
        if (userVoteData?.voteType) {
          setUserVote(userVoteData);
          setHasVoted(userVoteData && !userVoteData.canVoteAgain);
        }
      }
    } catch (error: any) {
      console.warn('Error fetching sentiment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType: 'bullish' | 'bearish') => {
    if (!isAuthenticated || !user) {
      // Could show a login prompt here
      return;
    }

    if (!symbol) {
      return;
    }

    if (hasVoted && userVote && !userVote.canVoteAgain) {
      if (userVote.nextVoteTime) {
        const nextVoteTime = new Date(userVote.nextVoteTime);
        const hoursLeft = Math.ceil((nextVoteTime.getTime() - Date.now()) / (1000 * 60 * 60));
        // Could show a toast here
      }
      return;
    }

    try {
      setVoting(true);
      
      // Configure animation
      LayoutAnimation.configureNext({
        duration: 300,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });

      const response = await postRequest('/api/sentiment', {
        symbol,
        voteType,
      });

      if (response) {
        setHasVoted(true);
        setUserVote({ voteType, canVoteAgain: false });
        
        // Refresh sentiment data to show updated results
        await fetchSentiment();
      }
    } catch (error: any) {
      console.warn('Error voting:', error);
    } finally {
      setVoting(false);
    }
  };

  const bullishPercent = sentimentData?.bullishPercent || 0;
  const bearishPercent = sentimentData?.bearishPercent || 0;
  const totalVotes = sentimentData?.totalVotes || 0;
  const userVoteType = userVote?.voteType || null;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Community Sentiment</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Sentiment</Text>

      <View style={styles.votingSection}>
        {/* Voting Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => handleVote('bullish')}
            disabled={voting || !isAuthenticated || (hasVoted && !userVote?.canVoteAgain)}
            style={[
              styles.voteButton,
              styles.bullishButton,
              (voting || !isAuthenticated || (hasVoted && !userVote?.canVoteAgain)) &&
                styles.buttonDisabled,
            ]}
            activeOpacity={0.8}
          >
            {voting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="trending-up" size={20} color="#fff" />
                <Text style={styles.buttonText}>I think it's going Up</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleVote('bearish')}
            disabled={voting || !isAuthenticated || (hasVoted && !userVote?.canVoteAgain)}
            style={[
              styles.voteButton,
              styles.bearishButton,
              (voting || !isAuthenticated || (hasVoted && !userVote?.canVoteAgain)) &&
                styles.buttonDisabled,
            ]}
            activeOpacity={0.8}
          >
            {voting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="trending-down" size={20} color="#fff" />
                <Text style={styles.buttonText}>I think it's going Down</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {!isAuthenticated && (
          <Text style={styles.loginPrompt}>Please login to vote</Text>
        )}

        {/* Show results after voting */}
        {hasVoted && userVoteType && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>
              🎉 You voted {userVoteType === 'bullish' ? 'Bullish' : 'Bearish'}!
            </Text>

            {sentimentData && totalVotes > 0 ? (
              <>
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      styles.bullishProgress,
                      { width: `${bullishPercent}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressBarFill,
                      styles.bearishProgress,
                      { width: `${bearishPercent}%` },
                    ]}
                  />
                </View>

                {/* Statistics */}
                <View style={styles.statsRow}>
                  <Text style={styles.statText}>
                    <Text style={styles.bullishStat}>{bullishPercent}%</Text> Bullish
                  </Text>
                  <Text style={styles.statSeparator}>·</Text>
                  <Text style={styles.statText}>
                    <Text style={styles.bearishStat}>{bearishPercent}%</Text> Bearish
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.loadingText}>Loading community sentiment...</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  votingSection: {
    gap: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  voteButton: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
  },
  bullishButton: {
    backgroundColor: '#10b981',
  },
  bearishButton: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginPrompt: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  resultsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  bullishProgress: {
    backgroundColor: '#10b981',
  },
  bearishProgress: {
    backgroundColor: '#ef4444',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  bullishStat: {
    fontWeight: '700',
    color: '#10b981',
  },
  bearishStat: {
    fontWeight: '700',
    color: '#ef4444',
  },
  statSeparator: {
    color: '#64748b',
    fontSize: 14,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
