import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View, type ListRenderItem} from 'react-native';
import {TRIP_ITEM_HEIGHT, TripListItem} from '../components/TripListItem';
import {useCoordinator} from '../navigation/useCoordinator';
import type {TripSummary} from '../types';
import {formatCurrency, formatDistance} from '../utils/format';
import {useTripHistoryViewModel} from '../viewmodels/useTripHistoryViewModel';

const keyExtractor = (trip: TripSummary) => trip.id;

/** Every row has the same height, so offsets are computed instead of measured. */
const getItemLayout = (_: ArrayLike<TripSummary> | null | undefined, index: number) => ({
  length: TRIP_ITEM_HEIGHT,
  offset: TRIP_ITEM_HEIGHT * index,
  index,
});

export function TripHistoryScreen() {
  const vm = useTripHistoryViewModel();
  const coordinator = useCoordinator();

  // Reload whenever the tab is shown, so a just-finished trip appears.
  useFocusEffect(
    useCallback(() => {
      vm.reload();
    }, [vm.reload]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const renderItem: ListRenderItem<TripSummary> = useCallback(
    ({item}) => <TripListItem trip={item} onPress={coordinator.showTripDetail} />,
    [coordinator.showTripDetail],
  );

  if (vm.loading && vm.trips.length === 0) {
    return <ActivityIndicator style={styles.centered} />;
  }

  return (
    <FlatList
      data={vm.trips}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
      onRefresh={vm.reload}
      refreshing={vm.loading}
      testID="trip-list"
      ListHeaderComponent={
        vm.trips.length > 0 ? (
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {vm.stats.count} trips · {formatCurrency(vm.stats.totalSpent, vm.stats.currency)} ·{' '}
              {formatDistance(vm.stats.totalKm)}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptyText}>
            {vm.error ?? 'Completed rides are saved on this device and show up here.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {flex: 1},
  header: {padding: 16, backgroundColor: '#f9fafb'},
  headerText: {fontSize: 14, color: '#4b5563'},
  empty: {padding: 32, alignItems: 'center'},
  emptyTitle: {fontSize: 18, fontWeight: '600', color: '#111827'},
  emptyText: {fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 6},
});
