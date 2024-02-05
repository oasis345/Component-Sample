<template>
  <div>
    <div class="q-pa-md q-gutter-sm row">
      <q-btn icon="mdi-file-excel" @click="service.uploadFile">
        Import File
        <input
          ref="fileUploader"
          type="file"
          class="hidden"
          accept=".xls, .xlsx, .xlsm, .xltm, .xlam, .xltx"
          @change="service.importingFile"
        />
      </q-btn>
      <q-btn v-once icon="mdi-clipboard-text" @click="service.pasteText"> Paste(Ctrl-V) </q-btn>
      <q-btn icon="mdi-check" @click="service.saveRows" :disable="service.checkDuplicatedFields()"> save </q-btn>
      <CheckboxField
        v-model="service.firstRowHeader"
        :model="{ type: 'CheckboxField' }"
        :viewModel="model"
        label="First line as a header"
      ></CheckboxField>
    </div>

    <div class="q-pa-md">
      <q-table
        class="my-sticky-header-table"
        :rows="service.firstRowHeader ? service.rows.slice(1) : service.rows"
        :columns="service.columns"
        :row-key="parentView?.model?.keyField"
        flat
        bordered
      >
        <template v-slot:header-cell="{ col }">
          <q-th>
            <SelectField
              v-model="service.headerLabel[col.keyField]"
              :model="{
                type: 'SelectField',
                keyField: parentView?.model?.keyField,
                labelField: parentView?.model?.labelField,
                optionItems: service.headerRows
              }"
              :viewModel="model"
              :viewService="parentView"
              :bgColor="service.getStateColor(service.headerFields[col.keyField])"
              @update:modelValue="service.onHeaderChange($event, col.keyField)"
            />
          </q-th>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="service.fileImporter.show">
      <q-card v-show="service.fileImporter.filename" style="width: 250px">
        <div class="q-pa-md q-gutter-sm">
          <div class="text-right pt-1">
            <q-btn text small flat @click="service.closeDataImporter">
              <q-icon :name="'mdi-close'" v-once />
            </q-btn>
          </div>
          <p align="center">{{ service.fileImporter.filename }}</p>
          <SelectField
            v-model="service.fileImporter.selectedSheet"
            :model="{
              type: 'SelectField',
              label: 'Please select a sheet',
              keyField: parentView?.model?.keyField,
              labelField: parentView?.model?.labelField,
              optionItems: service.getSheetList()
            }"
            :viewModel="model"
            :viewService="parentView"
          />
          <q-btn text @click="service.importRows"> <q-icon :name="'mdi-check'" v-once /> OK </q-btn>
        </div>
      </q-card>
    </q-dialog>

    <!-- <q-dialog v-model="">
      <q-card style="width: 350px">
        <div class="q-pa-md q-gutter-sm">
          <p align="center">{{ 'Select project you want to import into' }}</p>
          <q-btn text> Next </q-btn>
        </div>
      </q-card>
    </q-dialog> -->
  </div>
</template>

<script setup lang="ts">
import { DataGridViewModel, registry, Dict, OccamError } from '@occam4/common';
import _ from 'lodash';
import axios from 'axios';
import SelectField from 'fields/SelectField.vue';
import CheckboxField from 'fields/CheckboxField.vue';
import { nextTick, onMounted, ref } from 'vue';
import { ViewProps } from '../props';

const { createService } = registry;

const props = defineProps<ViewProps<DataGridViewModel>>();

const fileUploader = ref();

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
  clipboardData: DataTransfer;
}
const service = createService(
  class {
    rows: Dict[] = [];
    headerFields: Dict = {};
    headerRows: string[] = [];
    newHeaderRows: string[] = [];
    fieldsIndices: Dict = {};
    fileImporter: Dict = {};
    fileNameExtension = '';
    bodyElement: any;
    headerLabel: string[] = [];
    headerFieldList: string[] = [];
    firstRowHeader = true;

    get columns() {
      return props.parentView?.model.fields ? this.getColumnsWithFields() : this.getColumnsWithOutFields();
    }

    getColumnsWithFields() {
      const fields = this.getMatchingFields(props.parentView?.model.fields as Dict[]);
      const columns = [];

      if (fields)
        for (const idx in fields) {
          columns.push({
            name: fields[idx].name,
            label: fields[idx].label ?? fields[idx].name,
            field: fields[idx].name,
            align: 'left' as 'left' | 'right' | 'center',
            sortable: true,
            keyField: idx
          });
        }

      this.dataFormatter(columns);

      return columns;
    }

    getColumnsWithOutFields() {
      const columns = [];
      for (const idx in this.headerRows) {
        columns.push({
          name: this.headerRows[idx],
          label: this.headerRows[idx],
          field: this.headerRows[idx],
          align: 'left' as 'left' | 'right' | 'center',
          sortable: true,
          keyField: idx
        });
      }
      this.dataFormatter(columns);
      this.prepareHeaderFields(columns);

      return columns;
    }

    dataFormatter(columns: Dict[]) {
      for (const column of columns) {
        this.headerFieldList.push(column.field);
      }

      const newRows: Dict[] = [];
      let data: Dict = {};
      for (const row of this.rows) {
        for (let i = 0; i < this.headerFieldList.length; i++) {
          data[this.headerFieldList[i]] = row[i];
        }
        newRows.push(data);
        data = {};
      }

      this.rows = newRows;
    }

    getMatchingFields(fields: Dict[]) {
      const matchingField: Dict[] = [];

      for (const column of this.headerRows) {
        for (const field of fields) {
          if (column === field.name || column === field.label) {
            matchingField.push(field);
            break;
          }
        }

        if (!matchingField.some((field) => field.name === column || column === field.label))
          matchingField.push({ name: column, label: column, missing: true });
      }

      this.prepareHeaderFields(matchingField);
      return matchingField;
    }

    prepareHeaderFields(matchingFields: Dict[]) {
      for (const idx in matchingFields) {
        this.headerFields[idx] = { ...matchingFields[idx], duplicated: false };
      }
    }

    onHeaderChange(newFieldName: string, currentIdx: string) {
      this.updateHeaders(newFieldName, currentIdx);
      this.alignHeaders();
    }

    updateHeaders(name: string, idx: string) {
      const { fieldsIndices } = service;
      const currentIdx: Dict = this.headerFields[idx];

      if ((name && currentIdx?.missing) || name) {
        name = this.trimString(name);
        currentIdx.missing = false;
      } else {
        currentIdx.missing = true;
        currentIdx.duplicated = false;
      }

      this.prepareFieldsIndex();
      this.removePreIndex(idx);

      const indices: string[] = fieldsIndices[name];

      this.checkIndices(indices, idx, name);

      for (const field of Object.keys(fieldsIndices)) {
        const fieldIndex = fieldsIndices[field];

        if (fieldIndex.length > 1) fieldIndex.forEach((idx: string) => (this.headerFields[idx].duplicated = true));
        else fieldIndex.forEach((idx: string) => (this.headerFields[idx].duplicated = false));
      }
    }

    checkIndices(indices: string[], idx: string, name: string): void {
      if (indices?.length) {
        indices?.push(idx);
        return;
      }

      for (const field of Object.values(this.headerFields)) {
        if (this.trimString(field.label) === name) {
          service.fieldsIndices[this.trimString(field.name)]?.push(idx);
          break;
        }
      }
    }

    trimString(string: string): string {
      return string.toLowerCase().replaceAll(' ', '');
    }

    alignHeaders(): void {
      for (const fieldName in this.fieldsIndices) {
        this.newHeaderRows.splice(this.fieldsIndices[fieldName][0], 1, fieldName);
      }
    }

    prepareFieldsIndex(): void {
      for (const idx in this.headerFields) {
        const fieldName = this.headerFields[idx].name;

        if (this.fieldsIndices[fieldName]) continue;
        this.fieldsIndices[this.trimString(fieldName)] = [idx];
      }
    }

    removePreIndex(idx: string) {
      for (const field of Object.keys(this.fieldsIndices)) {
        if (this.fieldsIndices[field].includes(idx)) {
          this.fieldsIndices[field].splice(this.fieldsIndices[field].indexOf(idx), 1);
        }
      }
    }

    checkDuplicatedFields() {
      for (const idx in this.headerFields) {
        if (this.headerFields[idx]?.duplicated) return true;
      }
      return false;
    }

    getStateColor(field: Dict) {
      if (field?.duplicated) return 'red lighten-2';
      if (field?.missing) return 'yellow lighten-2';
    }

    uploadFile() {
      fileUploader.value.click();
    }

    async importingFile(e: HTMLInputEvent): Promise<void> {
      const { uiService } = registry;

      let file: File;
      if (e.target.files?.length) {
        file = e.target.files[0];
        this.fileNameExtension = file.name?.split('.').pop()?.toLocaleLowerCase() as string;
        e.target.value = '';
      } else throw new OccamError('Please upload proper file.');

      uiService.showLoading();

      const formData = new FormData();
      formData.append('file', file);

      const result = (await axios.post('/api/dataImporter/uploadFile', formData)).data;

      if (result && result.id) {
        this.fileImporter = {
          show: true,
          fileId: result.id,
          filename: result.name,
          sheetList: result.sheetList
        };
      } else {
        this.fileImporter = { sheetList: [], show: false };
      }

      uiService.hideLoading();
    }

    getSheetList() {
      return this.fileImporter.sheetList || [];
    }

    closeDataImporter() {
      this.fileImporter = { show: false, saveMode: false };
      this.clearAll();
    }

    clearAll() {
      this.clearData();
      this.fileImporter = {};
    }

    clearData() {
      this.rows = [];
      this.headerFields = [];
      this.headerRows = [];
      this.fieldsIndices = {};
      this.newHeaderRows = [];
      this.headerLabel = [];
      this.headerFieldList = [];
      this.firstRowHeader = true;
    }

    async saveRows() {
      const { uiService } = registry;
      if (this.rows.length < 1) return uiService.notify({ message: "Can't save empty row" });

      const newRows = (
        await axios.post('api/dataImporter/transformRows', {
          rows: this.rows,
          headerRows: this.newHeaderRows,
          fileNameExtension: this.fileNameExtension
        })
      ).data;

      await axios.post(`/api/data/${props.parentView?.model.name}`, newRows);
      uiService.notify({ message: `${this.rows.length} rows have been saved` });
      this.clearAll();
    }

    async importRows() {
      if (this.rows.length) this.clearData();

      const { uiService } = registry;
      this.fieldsIndices = {};
      if (!this.fileImporter.fileId || !this.fileImporter.selectedSheet) return;

      uiService.showLoading();

      const query = `sheetName=${this.fileImporter.selectedSheet}`;
      const rows: string[][] = (
        await axios.post(`/api/dataImporter/getRows/${this.fileImporter.fileId}?${query}`, {
          fileNameExtension: this.fileNameExtension
        })
      ).data;

      uiService.hideLoading();

      this.prepareHeadersAndRows(rows);

      this.fileImporter.show = false;
    }

    async pasteText() {
      this.onPasted(await navigator.clipboard.readText());
    }

    handlePasteEvent(e: HTMLInputEvent) {
      this.onPasted(e.clipboardData?.getData('text'));
    }

    async onPasted(text: string) {
      const rows: string[][] = (await axios.post('/api/dataImporter/parsePastedData', { text })).data;

      this.prepareHeadersAndRows(rows);
    }

    prepareHeadersAndRows(rows: string[][]) {
      this.headerLabel = _.cloneDeep(rows[0]);
      this.headerRows = _.cloneDeep(rows[0]);
      this.rows = rows;
    }
  }
);

onMounted(() => {
  nextTick(() => {
    service.bodyElement = document.querySelector('body');
    service.bodyElement?.addEventListener('paste', service.handlePasteEvent);
  });
});
</script>
