<template>
  <div>
    <q-form
      v-if="service.data"
      :style="{ visibility: service.loading ? 'hidden' : undefined }"
      v-bind="{ ...$attrs, ...model.componentProps }"
      ref="form"
      class="full-width"
      novalidate
      @submit="service.submit"
    >
      <q-list v-if="service.fieldGroups && fieldsType == 'formFields'">
        <q-expansion-item
          v-for="fieldGroup of service.fieldGroups"
          :key="fieldGroup.label"
          :label="fieldGroup.label"
          :default-opened="fieldGroup.defaultOpened"
          :header-class="fieldGroup.headerClass ?? 'bg-grey-2'"
          :dense="fieldGroup.dense"
          expand-separator
        >
          <div class="row">
            <template v-for="fieldModel of service.getGroupFields(fieldGroup)" :key="fieldModel.name">
              <div
                v-if="!service.isHidden(fieldModel)"
                :class="`q-px-sm q-pb-xs col-${fieldModel.cols ?? service.defaultCols}`"
              >
                <any-field
                  ref="fields"
                  v-model="service.data[fieldModel.name!]"
                  :data="service.data"
                  :model="fieldModel"
                  :viewModel="model"
                  :viewService="viewService ?? service"
                  :pageCtx="pageCtx"
                  :isNew="service.isNew"
                  isForm
                />
              </div>
            </template>
          </div>
        </q-expansion-item>
      </q-list>
      <div v-if="service.noGroupFields.length" class="q-px-xs full-width">
        <div class="row">
          <template v-for="fieldModel of service.noGroupFields" :key="fieldModel.name">
            <div
              v-if="!service.isHidden(fieldModel)"
              :class="`q-px-sm q-pb-xs col-${fieldModel.cols ?? service.defaultCols}`"
            >
              <any-field
                ref="fields"
                v-model="service.data[fieldModel.name!]"
                :data="service.data"
                :model="fieldModel"
                :viewModel="model"
                :viewService="viewService ?? service"
                :pageCtx="pageCtx"
                :isNew="service.isNew"
                isForm
              />
            </div>
          </template>
        </div>
      </div>
    </q-form>
    <div v-if="service.loading" class="fixed bg-grey-2 z-top">
      <q-spinner size="lg" class="fixed-center" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  DataViewService,
  FieldGroupModel,
  FieldModel,
  FieldService,
  FieldsType,
  FormViewModel,
  isSelectableField,
  ViewService,
  OccamError,
  registry,
  isDefined,
  assignObjectNotExist,
  ViewProps,
  PageCtx
} from '@occam4/common';
import { QForm } from 'quasar';
import { createService } from 'services';
import { ref, watch } from 'vue';

const { dataService, modelService, uiService, callProp } = registry;
const anyField = uiService.getComponent('Field', 'AnyField');

interface FormProps {
  model: FormViewModel;
  modelValue?: any;
  selectedData?: any;
  dataId?: string;
  isPage?: boolean;
  parentView?: ViewService;
  pageCtx?: PageCtx;
  viewService?: ViewService; // mainView for Page Fields Form
  updateDirectly?: boolean;
  fieldsType?: FieldsType;
  defaultCols?: number;
}
const props = withDefaults(defineProps<FormProps>(), { fieldsType: 'formFields' });

const emits = defineEmits<{
  (event: 'update:modelValue', value: any): void;
  (event: 'submit', value: any): void;
  (event: 'close'): void;
}>();
const form = ref<QForm>();
const fields = ref();

const service = createService(
  class FormViewService extends DataViewService<FormViewModel> {
    constructor(props: ViewProps<FormViewModel>) {
      super(props);
    }

    isNew = false;

    loading = true;

    get fieldModels() {
      const fieldModels = modelService
        .getFields(this.model, props.fieldsType, {
          viewService: this
        })
        .filter((field) => !this.isNew || field.creatable !== false)
        .map((field) => (props.fieldsType == 'pageFields' ? { ...field, required: false, updatable: true } : field));
      return fieldModels;
    }

    get selectedData() {
      return this.data;
    }

    get fieldGroups() {
      const fieldGroups = [...(this.model.fieldGroups ?? [])];
      if (this.model.extraFieldGroup) fieldGroups.push(this.model.extraFieldGroup);
      return fieldGroups;
    }

    get dataId() {
      if (props.dataId == '$new') return;
      return props.dataId;
    }

    get defaultCols() {
      return this.model.defaultCols ?? props.defaultCols ?? 6;
    }

    isHidden(fieldModel: FieldModel): boolean {
      return callProp(fieldModel, 'hidden', { viewService: service });
    }

    getGroupFields(group: FieldGroupModel): FieldModel[] {
      if (this.model.extraFieldGroup == group) return this.extraFields;
      return group
        .groupFields!.map((groupField) => this.fieldModels.find((fieldModel) => fieldModel.name == groupField))
        .filter(isDefined);
    }

    get noGroupFields() {
      if (this.model.extraFieldGroup && props.fieldsType == 'formFields') {
        return [];
      } else if (this.model.fieldGroups && props.fieldsType == 'formFields') {
        return this.extraFields;
      } else {
        return this.fieldModels;
      }
    }

    get extraFields() {
      const groupFields = this.model.fieldGroups?.map((fieldGroup) => fieldGroup.groupFields).flat();
      return this.fieldModels.filter((field) => !groupFields?.includes(field.name!));
    }

    async validate() {
      const valid = await form.value?.validate();
      if (!valid)
        uiService.notify({
          message: `Please check ${this.getErrorFields()?.join(', ')}`,
          type: 'warning'
        });
      return valid;
    }

    getErrorFields(): string[] {
      return form
        .value!.getValidationComponents()
        .filter((comp) => comp.hasError)
        .map((comp) => comp.label as string);
    }

    async beforeSubmit() {
      for (const field of fields.value!) {
        const fieldService: FieldService = field.value;
        await fieldService?.beforeSubmit?.();
      }
    }

    async submit(value?: any) {
      await this.beforeSubmit();
      if (!(await this.validate())) return;
      const view = modelService.getServerView(this.model);
      let result;
      if (view && props.fieldsType === 'formFields') {
        if (this.model.submitAction) {
          const action = modelService.getWebAction(this.model, this.model.submitAction);
          await modelService.executeAction({
            model: action,
            viewModel: this.model,
            data: this.data,
            dataId: this.dataId
          });
        } else {
          if (this.isNew) {
            result = await dataService.create({
              view,
              data: this.data,
              params: modelService.getOptionParams(this.model, this)
            });
          } else {
            result = await dataService.update({
              view,
              data: this.data,
              dataId: this.dataId,
              params: modelService.getOptionParams(this.model, this)
            });
          }
        }
      }
      callProp(this.model, 'onSubmitted', {
        viewService: this,
        value: result,
        data: this.data,
        dataId: this.dataId,
        pageCtx: props.pageCtx
      });
      emits('update:modelValue', this.data);
      emits('submit', value ?? this.data);
    }

    async refresh() {
      this.loading = true;

      this.isNew = !this.dataId && props.fieldsType == 'formFields';

      if (props.updateDirectly && props.modelValue) {
        this.data = props.modelValue;
      } else {
        const serverView = modelService.getServerView(props.model);
        if (!this.isNew && serverView) {
          // server view
          // TODO: Form live 처리
          if (this.dataId) {
            this.data = await dataService.get({
              view: serverView,
              dataId: this.dataId,
              select: this.fieldModels.filter(isSelectableField).map((field) => field.name!),
              serializer: props.model.serializer
            });
          } else if (props.modelValue) {
            this.data = props.modelValue;
          }
          if (!this.data) {
            throw new OccamError(`There is no data or no permission ${this.dataId} of ${serverView}`);
          }
        } else {
          // no server
          this.data = props.modelValue ?? {};
        }
      }

      // modelValue가 없으면 defaultData를 data로 사용, pageFields는 AnyView에서 defaultData처리
      if (this.isNew) {
        const defaultData = dataService.getDefaultData(
          { model: this.model, viewService: this, data: this.data, dataId: this.dataId, pageCtx: props.pageCtx },
          { fieldsType: props.fieldsType }
        );

        this.data = assignObjectNotExist(this.data ?? {}, defaultData);
      }

      if (!props.updateDirectly) {
        // updateDirectly시에는 새 object로 교체되면 안됨
        this.data = dataService.applyComputed(this.data ?? {}, props.model);
      }

      if (this.isNew && props.updateDirectly) emits('update:modelValue', this.data);

      this.loading = false;
    }
  },
  props
);

watch(
  () => [props.modelValue, props.dataId],
  () => service.refresh(),
  { immediate: true }
);

defineExpose(service);
</script>
