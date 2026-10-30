import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { List, useTheme } from 'react-native-paper';
import { getPets } from '../../di/container';
import type { Pet } from '../../domain/entities/Pet';


export default function PetListScreen() {
  const theme = useTheme();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    getPets.execute().then(setPets);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.breed ?? 'Chưa rõ giống'} · ${item.weightKg} kg`}
            left={(props) => (
              <List.Icon {...props} icon={item.species === 'dog' ? 'dog' : 'cat'} />
            )}
          />
        )}
      />
    </View>
  );
}