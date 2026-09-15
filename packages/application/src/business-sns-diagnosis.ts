export type BusinessSnsDiagnosisStatus = 'READY' | 'NEEDS_ACTION';

export interface BusinessSnsDiagnosisItem {
  key: 'OFFER' | 'AUDIENCE' | 'SOCIAL' | 'DESTINATION' | 'DELIVERY';
  title: string;
  description: string;
  status: BusinessSnsDiagnosisStatus;
}

export interface BusinessSnsDiagnosis {
  score: number;
  readyCount: number;
  totalCount: number;
  headline: string;
  summary: string;
  items: BusinessSnsDiagnosisItem[];
  nextAction: {
    itemKey: BusinessSnsDiagnosisItem['key'] | null;
    title: string;
    description: string;
  };
}

const present = (value: string | null | undefined) => Boolean(value?.trim());

export function diagnoseBusinessSnsReadiness(input: {
  productService: string;
  targetAudience: string;
  businessFeatures: string | null;
  activeSocialProfileCount: number;
  hasApprovedDestination: boolean;
  automaticDeliveryEnabled: boolean;
}): BusinessSnsDiagnosis {
  const items: BusinessSnsDiagnosisItem[] = [
    {
      key: 'OFFER',
      title: '紹介する商品・サービス',
      description: present(input.productService)
        ? '何を紹介するか決まっています。'
        : '最初に、いちばん紹介したい商品・サービスを決めましょう。',
      status: present(input.productService) ? 'READY' : 'NEEDS_ACTION',
    },
    {
      key: 'AUDIENCE',
      title: '届けたいお客様と自社の強み',
      description:
        present(input.targetAudience) && present(input.businessFeatures)
          ? '誰に何を伝えるか整理できています。'
          : '投稿を届けたい相手と、選ばれる理由を言葉にしましょう。',
      status:
        present(input.targetAudience) && present(input.businessFeatures) ? 'READY' : 'NEEDS_ACTION',
    },
    {
      key: 'SOCIAL',
      title: '投稿に使うSNS',
      description:
        input.activeSocialProfileCount > 0
          ? '使うSNSが決まっています。'
          : 'まずは、実際に使うSNSを一つだけ選びましょう。',
      status: input.activeSocialProfileCount > 0 ? 'READY' : 'NEEDS_ACTION',
    },
    {
      key: 'DESTINATION',
      title: '投稿を見た人の案内先',
      description: input.hasApprovedDestination
        ? 'プロフィールなど、投稿を見た人の次の行き先が決まっています。'
        : 'プロフィールや問い合わせ先など、次に見てほしい場所を決めましょう。',
      status: input.hasApprovedDestination ? 'READY' : 'NEEDS_ACTION',
    },
    {
      key: 'DELIVERY',
      title: '毎日の案内を受け取る準備',
      description: input.automaticDeliveryEnabled
        ? 'LINEで今日やることを受け取る準備ができています。'
        : '受信時刻を決めて、LINEのお届けを始めましょう。',
      status: input.automaticDeliveryEnabled ? 'READY' : 'NEEDS_ACTION',
    },
  ];
  const readyCount = items.filter(({ status }) => status === 'READY').length;
  const score = readyCount * 20;
  const next = items.find(({ status }) => status === 'NEEDS_ACTION');

  return {
    score,
    readyCount,
    totalCount: items.length,
    headline:
      score === 100
        ? '今日からSNS集客を始められます'
        : score >= 60
          ? 'あと少しで始められます'
          : '準備を一つずつ進めましょう',
    summary:
      score === 100
        ? '必要な準備がそろっています。今日やることを一つ確認しましょう。'
        : `準備できている項目は${readyCount}つです。全部を一度に直さなくて大丈夫です。`,
    items,
    nextAction: next
      ? {
          itemKey: next.key,
          title: next.title,
          description: next.description,
        }
      : {
          itemKey: null,
          title: '今日やることを確認する',
          description: '現在の90日計画に合う、一つの集客行動へ進みます。',
        },
  };
}
