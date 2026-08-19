export type Participant = { id: string; name: string };

export type Topic = { id: string; label: string; description: string };
export type Principle = { id: string; title: string; body: string };

export type RoundOneQuestion = { key: string; text: string };

export type SynthesizeTopicsInput = {
  participants: Participant[];
  questions: RoundOneQuestion[];
  // questionKey -> participantId -> answer text
  answers: Record<string, Record<string, string>>;
  numTopics?: number;
};

export type DraftPrinciplesInput = {
  topics: Topic[];
  participantCount: number;
  pickCounts: Record<string, number>;
  // topicId -> formatted comment lines, e.g. `Alex: "we ship too slow"`
  commentsByTopic: Record<string, string[]>;
  numPrinciples?: number;
};

export type RevisePrinciplesInput = {
  principles: Principle[];
  // principleId -> comments left on it
  commentsByPrincipleId: Record<string, { name: string; text: string }[]>;
};
