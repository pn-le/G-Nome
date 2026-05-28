import { ViewStyle } from 'react-native';

export const colors = {
  bg:           '#F7F6F2',
  surface:      '#FFFFFF',
  border:       '#E5E2DB',
  textPrimary:  '#1A1B14',
  textSecondary:'#686760',
  textLight:    '#A6A59F',
  olive:        '#363E28',
  green:        '#44A353',
  greenLightBg: '#EEF2E9',
  greenSoft:    '#DAE4CF',
  red:          '#EB412A',
  redBg:        '#FEF1F1',
  amber:        '#F5A62B',
  amberBg:      '#FFF7E2',
  blue:         '#4A90F9',
  blueBg:       '#E5EEFE',
  purple:       '#9966FE',
  purpleBg:     '#EDE9FF',
  teal:         '#0D9488',
  tealBg:       '#E6FAF8',
};

export const fonts = {
  display:  'PlayfairDisplay_700Bold',
  body:     'InriaSerif_400Regular',
  bodyBold: 'InriaSerif_700Bold',
  mono:     'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_700Bold',
};

export const radius = {
  card:   13,
  badge:   6,
  button: 12,
  pill:   26,
};

export const shadow: { card: ViewStyle } = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 3,
  },
};
