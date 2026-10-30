import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function PlaceholderScreen({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <Text variant="titleMedium">{title}</Text>
    </View>
  );
}