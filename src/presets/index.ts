import meteor from './meteor';
import next from './next';
import node from './node';
import reactNative from './react-native';
import vue from './vue';
import { Preset } from '../config';

export const presets: Preset[] = [next, reactNative, vue, meteor, node];
