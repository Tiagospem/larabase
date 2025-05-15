<script setup lang="ts">
  import { ref, watch, toRaw } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { useConnectionsStore } from '@/store/connections';
  import { useTableStructure } from '@/composables/useTableStructure';
  import UpdatePasswordModal from '@/components/database/tables/UpdatePasswordModal.vue';

  const props = defineProps({
    show: {
      type: Boolean,
      required: true,
    },
    record: {
      type: Object,
      required: true,
    },
    tableName: {
      type: String,
      required: true,
    },
    tableStructure: {
      type: Array,
      required: true,
    },
  });

  const emit = defineEmits(['close', 'refresh']);

  const connectionStore = useConnectionsStore();
  const tableStructureHelper = useTableStructure();

  const formData = ref<Record<string, any>>({});
  const isUpdating = ref(false);
  const updateError = ref('');
  const showPasswordModal = ref(false);
  const selectedPasswordField = ref('');

  watch(
    () => props.tableStructure,
    newStructure => {
      if (newStructure && Array.isArray(newStructure) && newStructure.length > 0) {
        tableStructureHelper.initializeWithStructure(newStructure);
      }
    },
    { immediate: true }
  );

  const isDateTimeColumn = (columnName: string): boolean => {
    return tableStructureHelper.isDateTimeColumn(columnName);
  };

  const isNumberColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType
      ? columnType.includes('int') ||
          columnType.includes('decimal') ||
          columnType.includes('float') ||
          columnType.includes('double')
      : false;
  };

  const isTextColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType.includes('text') || columnType.includes('longtext') : false;
  };

  const isJsonColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType.includes('json') : false;
  };

  const isBooleanColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType === 'tinyint(1)' || columnType === 'boolean' : false;
  };

  const isEnumColumn = (columnName: string): boolean => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    return columnType ? columnType.includes('enum') : false;
  };

  const getEnumValues = (columnName: string): string[] => {
    const columnType = tableStructureHelper.getColumnType(columnName);
    if (!columnType || !columnType.includes('enum')) return [];

    try {
      const matches = columnType.match(/enum\((.+)\)/i);

      if (matches && matches[1]) {
        return matches[1]
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''))
          .filter(Boolean);
      }
    } catch (e) {
      console.error('Error parsing enum values:', e);
    }

    return [];
  };

  const getInputType = (columnName: string): string => {
    if (isDateTimeColumn(columnName)) {
      const columnType = tableStructureHelper.getColumnType(columnName);
      return columnType === 'date' ? 'date' : 'datetime-local';
    }

    if (isNumberColumn(columnName)) {
      return 'number';
    }

    return 'text';
  };

  watch(
    () => props.record,
    newRecord => {
      if (newRecord) {
        formData.value = { ...newRecord };

        if (tableStructureHelper.structure && tableStructureHelper.structure.value) {
          tableStructureHelper.structure.value.forEach(column => {
            if (isEnumColumn(column.name)) {
              if (
                formData.value[column.name] === null ||
                formData.value[column.name] === undefined
              ) {
                formData.value[column.name] = '';
              } else {
                const enumValues = getEnumValues(column.name);
                const currentValue = String(formData.value[column.name]);

                const exactMatch = enumValues.find(v => v === currentValue);
                if (exactMatch) {
                  formData.value[column.name] = exactMatch;
                } else {
                  const caseInsensitiveMatch = enumValues.find(
                    v => v.toLowerCase() === currentValue.toLowerCase()
                  );
                  if (caseInsensitiveMatch) {
                    formData.value[column.name] = caseInsensitiveMatch;
                  } else {
                    formData.value[column.name] = currentValue;
                  }
                }
              }
            }

            if (isDateTimeColumn(column.name) && formData.value[column.name]) {
              const columnType = tableStructureHelper.getColumnType(column.name);
              const date = new Date(formData.value[column.name]);

              if (!isNaN(date.getTime())) {
                if (columnType === 'date') {
                  formData.value[column.name] = date.toISOString().split('T')[0];
                } else {
                  formData.value[column.name] = date.toISOString().slice(0, 16);
                }
              }
            }

            if (isJsonColumn(column.name) && formData.value[column.name]) {
              try {
                if (typeof formData.value[column.name] === 'string') {
                  formData.value[column.name] = JSON.parse(formData.value[column.name]);
                }

                formData.value[`${column.name}_raw`] =
                  typeof formData.value[column.name] === 'object'
                    ? JSON.stringify(formData.value[column.name], null, 2)
                    : String(formData.value[column.name]);
              } catch (e) {
                formData.value[`${column.name}_raw`] =
                  typeof formData.value[column.name] === 'object'
                    ? JSON.stringify(formData.value[column.name], null, 2)
                    : String(formData.value[column.name]);
              }
            }

            if (isBooleanColumn(column.name)) {
              if (formData.value[column.name] === 1 || formData.value[column.name] === '1') {
                formData.value[column.name] = true;
              } else if (formData.value[column.name] === 0 || formData.value[column.name] === '0') {
                formData.value[column.name] = false;
              } else {
                formData.value[column.name] = Boolean(formData.value[column.name]);
              }
            }
          });
        }
      }
    },
    { immediate: true }
  );

  const handleJsonInput = (columnName: string, value: string) => {
    try {
      formData.value[`${columnName}_raw`] = value;
      formData.value[columnName] = JSON.parse(value);
    } catch (e) {
      formData.value[`${columnName}_raw`] = value;
    }
  };

  const updateRecord = async () => {
    if (!connectionStore.getSelectedProject) return;

    try {
      isUpdating.value = true;
      updateError.value = '';

      const processedFormData = { ...formData.value };

      if (tableStructureHelper.structure && tableStructureHelper.structure.value) {
        tableStructureHelper.structure.value.forEach(column => {
          if (isJsonColumn(column.name)) {
            if (processedFormData[`${column.name}_raw`]) {
              try {
                processedFormData[column.name] = JSON.parse(
                  processedFormData[`${column.name}_raw`]
                );
              } catch (e) {
                console.error(`Error parsing JSON for ${column.name}:`, e);
              }
            }

            delete processedFormData[`${column.name}_raw`];
          }

          if (isEnumColumn(column.name)) {
            if (column.isNullable && processedFormData[column.name] === '') {
              processedFormData[column.name] = null;
            }
          }

          if (isBooleanColumn(column.name)) {
            if (typeof processedFormData[column.name] === 'boolean') {
            } else if (
              processedFormData[column.name] === '1' ||
              processedFormData[column.name] === 1
            ) {
              processedFormData[column.name] = true;
            } else if (
              processedFormData[column.name] === '0' ||
              processedFormData[column.name] === 0
            ) {
              processedFormData[column.name] = false;
            } else {
              processedFormData[column.name] = Boolean(processedFormData[column.name]);
            }
          }

          if (
            column.isNullable &&
            (processedFormData[column.name] === '' || processedFormData[column.name] === undefined)
          ) {
            processedFormData[column.name] = null;
          }

          if (
            processedFormData[column.name] !== null &&
            typeof processedFormData[column.name] === 'object'
          ) {
            try {
              processedFormData[column.name] = JSON.stringify(processedFormData[column.name]);
            } catch (e) {
              console.error(`Error serializing ${column.name}:`, e);

              if (column.isNullable) {
                processedFormData[column.name] = null;
              } else {
                processedFormData[column.name] = String(processedFormData[column.name]);
              }
            }
          }
        });
      }

      const cleanData = Object.fromEntries(
        Object.entries(processedFormData)
          .map(([key, value]) => {
            if (key.endsWith('_raw')) return [null, null];

            if (value instanceof Date) {
              return [key, value.toISOString()];
            }

            if (value !== null && typeof value === 'object') {
              try {
                return [key, JSON.stringify(value)];
              } catch (e) {
                return [key, String(value)];
              }
            }
            return [key, value];
          })
          .filter(([key]) => key !== null)
      );

      const response = await window.ipcRenderer.updateTableRecord({
        dbConnection: toRaw(connectionStore.getSelectedProject.db_config),
        tableName: props.tableName,
        data: cleanData,
        id: processedFormData.id,
      });

      if (response.success) {
        emit('refresh');
        emit('close');
      } else {
        updateError.value = response.message || 'Failed to update record';
      }
    } catch (error: any) {
      updateError.value = error.message || 'An error occurred while updating the record';
    } finally {
      isUpdating.value = false;
    }
  };

  const isPasswordField = (columnName: string): boolean => {
    return props.tableName === 'users' && columnName === 'password';
  };

  const openPasswordModal = (columnName: string) => {
    selectedPasswordField.value = columnName;
    showPasswordModal.value = true;
  };

  const handlePasswordModalClose = () => {
    showPasswordModal.value = false;
    selectedPasswordField.value = '';
  };

  const handlePasswordModalRefresh = () => {
    emit('refresh');
  };
</script>

<template>
  <Modal
    :show="show"
    title="Edit Record"
    @close="emit('close')"
    @action="updateRecord"
    :show-action-button="true"
    :is-loading-action="isUpdating"
    action-button-text="Update Record"
  >
    <div class="max-h-[70vh] overflow-y-auto">
      <div v-if="updateError" class="alert alert-error mb-4">
        <p>{{ updateError }}</p>
      </div>

      <div class="flex flex-col px-1">
        <div
          v-for="column in tableStructureHelper.structure?.value || []"
          :key="column.name"
          class="form-item border-base-100 border-b"
        >
          <fieldset class="fieldset">
            <label class="label mb-1">
              <span class="label-text font-medium">
                {{ column.name }}
                <span v-if="column.isPrimaryKey" class="text-warning ml-1 text-xs"
                  >(Primary Key)</span
                >
                <span v-else-if="column.isForeignKey" class="text-info ml-1 text-xs"
                  >(Foreign Key)</span
                >
              </span>
              <span v-if="column.isNullable" class="label-text-alt">Optional</span>
            </label>

            <template v-if="isPasswordField(column.name)">
              <div class="flex items-center gap-2">
                <input
                  type="password"
                  disabled
                  placeholder="********"
                  class="input input-bordered flex-1"
                />
                <button
                  type="button"
                  class="btn btn-primary"
                  @click="openPasswordModal(column.name)"
                >
                  Change Password
                </button>
              </div>
            </template>

            <template v-else-if="isJsonColumn(column.name)">
              <textarea
                v-model="formData[`${column.name}_raw`]"
                class="textarea textarea-bordered w-full font-mono text-sm"
                rows="5"
                :placeholder="`Enter JSON for ${column.name}`"
                @input="e => handleJsonInput(column.name, (e.target as HTMLTextAreaElement).value)"
              ></textarea>
            </template>

            <template v-else-if="isTextColumn(column.name)">
              <textarea
                v-model="formData[column.name]"
                class="textarea textarea-bordered w-full"
                rows="4"
                :placeholder="`Enter text for ${column.name}`"
              ></textarea>
            </template>

            <template v-else-if="isEnumColumn(column.name)">
              <select v-model="formData[column.name]" class="select select-bordered w-full">
                <option v-if="column.isNullable" value="">Select an option</option>
                <option v-for="value in getEnumValues(column.name)" :key="value" :value="value">
                  {{ value }}
                </option>
              </select>
            </template>

            <template v-else-if="isBooleanColumn(column.name)">
              <div class="mt-2 ml-2 flex items-center space-x-6">
                <label class="flex cursor-pointer items-center space-x-3">
                  <input
                    type="radio"
                    :name="`boolean-${column.name}`"
                    :checked="formData[column.name] === true"
                    @change="formData[column.name] = true"
                    class="radio radio-primary"
                  />
                  <span class="text-sm">Yes</span>
                </label>

                <label class="flex cursor-pointer items-center space-x-3">
                  <input
                    type="radio"
                    :name="`boolean-${column.name}`"
                    :checked="formData[column.name] === false"
                    @change="formData[column.name] = false"
                    class="radio radio-primary"
                  />
                  <span class="text-sm">No</span>
                </label>
              </div>
            </template>

            <template v-else>
              <input
                v-model="formData[column.name]"
                :type="getInputType(column.name)"
                class="input input-bordered input-sm w-full"
                :placeholder="`Enter ${column.name}`"
                :disabled="column.isPrimaryKey"
                :step="
                  isNumberColumn(column.name) && getInputType(column.name) === 'number'
                    ? 'any'
                    : undefined
                "
              />
            </template>

            <label v-if="column.type" class="label">
              <span class="badge badge-sm badge-base-100">{{ column.type }}</span>
            </label>
          </fieldset>
        </div>
      </div>
    </div>
  </Modal>

  <UpdatePasswordModal
    v-if="showPasswordModal"
    :show="showPasswordModal"
    :record="props.record"
    :table-name="props.tableName"
    :table-structure="props.tableStructure"
    @close="handlePasswordModalClose"
    @refresh="handlePasswordModalRefresh"
  />
</template>

<style scoped>
  .radio {
    height: 1.2rem;
    width: 1.2rem;
  }

  .form-item {
    padding-bottom: 1.5rem;
  }

  .form-item:last-child {
    border-bottom: none;
  }

  .input,
  .select,
  .textarea {
    width: 100%;
    max-width: calc(100% - 2px);
    margin: 0;
  }
</style>
