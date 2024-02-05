<template>
  <q-table :rows="modelValue" :columns="service.columns" :row-key="model.keyField" />
</template>

<script setup lang="ts">
import { DataGridViewModel } from '@occam4/common';
import { QTableProps } from 'quasar';
import { createService } from 'services';
import { ViewProps } from '../props';

const props = defineProps<ViewProps<DataGridViewModel>>();
const service = createService(
  class {
    get columns(): QTableProps['columns'] {
      return props.model.fields!.map((field) => {
        return {
          name: field.name!,
          label: field.label! as string,
          field: field.name!
        };
      });
    }
  }
);
</script>
